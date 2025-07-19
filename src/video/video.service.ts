import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { MediaService } from '@/media/media.service';
import { Logger } from '@nestjs/common';
import {
  Video,
  VideoFeedOptions,
  VideoWithUrls,
  VideoFeedResponse,
} from '@movapp/types';

@Injectable()
export class VideoService {
  private readonly logger = new Logger(VideoService.name);

  constructor(
    private prisma: PrismaService,
    private mediaService: MediaService,
  ) {}

  async create(data: {
    videoPath: string;
    thumbnailPath: string;
    userId: string;
    status?: string;
  }) {
    return this.prisma.video.create({
      data: {
        ...data,
        status: data.status || 'pending',
      },
      include: {
        user: {
          select: { id: true, username: true, profileThumbnailPath: true },
        },
      },
    });
  }

  async getEventVideoFeed(
    eventId: string,
    options: VideoFeedOptions,
  ): Promise<VideoFeedResponse> {
    const { cursor, limit, userId } = options;

    // Build where clause with proper typing
    interface WhereClause {
      status: string;
      events: {
        some: {
          eventId: string;
        };
      };
      userId?: string;
      createdAt?: {
        lt: Date;
      };
    }

    const whereClause: WhereClause = {
      status: 'published',
      events: {
        some: {
          eventId: eventId,
        },
      },
    };

    if (userId) {
      whereClause.userId = userId;
    }

    // Use timestamp-based cursor pagination
    if (cursor) {
      whereClause.createdAt = {
        lt: new Date(cursor),
      };
    }

    try {
      const videos = await this.prisma.video.findMany({
        where: whereClause,
        include: {
          user: {
            select: { id: true, username: true, profileThumbnailPath: true },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit + 1, // Fetch one extra to check if there are more
      });

      // Check if there are more videos
      const hasMore = videos.length > limit;
      const videosToReturn = hasMore ? videos.slice(0, limit) : videos;

      // Generate signed URLs for all videos
      const videosWithUrls: VideoWithUrls[] = await Promise.all(
        videosToReturn.map(async (video) => {
          const videoUrl = await this.mediaService.getPresignedDownloadUrl(
            video.videoPath,
          );
          const thumbnailUrl = await this.mediaService.getPresignedDownloadUrl(
            video.thumbnailPath,
          );

          // Generate presigned URL for user profile thumbnail
          let userProfileThumbnailUrl: string | null = null;
          if (video.user.profileThumbnailPath) {
            userProfileThumbnailUrl =
              await this.mediaService.getPresignedDownloadUrl(
                video.user.profileThumbnailPath,
              );
          }

          return {
            id: video.id,
            videoPath: video.videoPath,
            thumbnailPath: video.thumbnailPath,
            videoUrl,
            thumbnailUrl,
            createdAt: video.createdAt,
            user: {
              ...video.user,
              profileThumbnailUrl: userProfileThumbnailUrl,
            },
          };
        }),
      );

      // Set next cursor to the createdAt timestamp of the last video
      const nextCursor =
        hasMore && videosToReturn.length > 0
          ? videosToReturn[videosToReturn.length - 1].createdAt.toISOString()
          : null;

      return {
        videos: videosWithUrls,
        nextCursor,
        hasMore,
      };
    } catch (error) {
      this.logger.error('Error fetching video feed:', error);
      throw error;
    }
  }

  /**
   * Find video by storage path
   */
  async findByStoragePath(videoPath: string) {
    return this.prisma.video.findUnique({
      where: { videoPath },
      include: {
        user: {
          select: { id: true, username: true, profileThumbnailPath: true },
        },
        events: {
          include: {
            event: true,
          },
        },
      },
    });
  }

  async findById(videoId: string) {
    return this.prisma.video.findUnique({
      where: { id: videoId },
      include: {
        user: {
          select: { id: true, username: true, profileThumbnailPath: true },
        },
        events: {
          include: {
            event: true,
          },
        },
      },
    });
  }

  async associateWithEvents(videoId: string, eventIds: string[]) {
    return this.prisma.$transaction(async (tx) => {
      // Update video status to published
      await tx.video.update({
        where: { id: videoId },
        data: { status: 'published' },
      });

      await this.prisma.videoEvent.createMany({
        data: eventIds.map((eventId) => ({
          videoId,
          eventId,
        })),
        skipDuplicates: true,
      });

      return this.findById(videoId);
    });
  }

  async delete(videoId: string) {
    const video = await this.findById(videoId);

    if (!video) {
      throw new Error('Video not found');
    }

    return this.deleteVideoAndFiles(video);
  }

  private async deleteVideoAndFiles(video: Video & { thumbnailPath: string }) {
    try {
      // Delete both video and thumbnail from R2
      await this.mediaService.deleteMultipleFiles([
        video.videoPath,
        video.thumbnailPath,
      ]);

      // Delete from database (cascading will remove VideoEvent relations)
      return this.prisma.video.delete({
        where: { id: video.id },
      });
    } catch (error) {
      this.logger.error('Error deleting video and files:', error);
      throw error;
    }
  }

  /**
   * Report a video from an event
   * Removes the video from the specific event and marks it as reported
   */
  async reportVideo(videoId: string, eventId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      // Check if user is a participant of the event
      const participant = await tx.eventParticipant.findUnique({
        where: {
          userId_eventId: {
            userId,
            eventId,
          },
        },
      });

      if (!participant) {
        throw new Error('User is not a participant of this event');
      }

      // Check if video exists and is associated with the event
      const videoEvent = await tx.videoEvent.findUnique({
        where: {
          videoId_eventId: {
            videoId,
            eventId,
          },
        },
        include: {
          video: true,
        },
      });

      if (!videoEvent) {
        throw new Error('Video is not associated with this event');
      }

      // Remove video from the event
      await tx.videoEvent.delete({
        where: {
          videoId_eventId: {
            videoId,
            eventId,
          },
        },
      });

      // Mark video as reported
      await tx.video.update({
        where: { id: videoId },
        data: {
          reported: true,
          reportedAt: new Date(),
          reportedBy: userId,
        },
      });

      return videoEvent.video;
    });
  }

  /**
   * Clean up orphaned videos
   */
  async cleanupOrphanedVideos() {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    // Find orphaned videos
    const orphanedVideos = await this.prisma.video.findMany({
      where: {
        status: 'pending',
        createdAt: {
          lt: tenMinutesAgo,
        },
        events: {
          none: {}, // No event associations
        },
      },
    });

    this.logger.log(
      `Found ${orphanedVideos.length} orphaned videos to clean up`,
    );

    // Delete each orphaned video
    let deletedCount = 0;
    for (const video of orphanedVideos) {
      try {
        await this.deleteVideoAndFiles(
          video as Video & { thumbnailPath: string },
        );
        deletedCount++;
      } catch (error) {
        this.logger.error(
          `Failed to delete orphaned video ${video.id}:`,
          error,
        );
      }
    }

    return deletedCount;
  }
}
