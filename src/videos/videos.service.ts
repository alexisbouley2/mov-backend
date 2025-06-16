import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { EventsVideosService } from '../events-videos/events-videos.service';
import { Video } from '../../generated/prisma';

interface VideoFeedOptions {
  cursor?: string;
  limit: number;
  userId?: string; // Filter by specific user
}

interface VideoWithUrls {
  id: string;
  storagePath: string;
  thumbnailPath: string;
  videoUrl: string;
  thumbnailUrl: string;
  createdAt: Date;
  user: {
    id: string;
    username: string;
    photo: string | null;
  };
}

interface VideoFeedResult {
  videos: VideoWithUrls[];
  nextCursor: string | null;
  hasMore: boolean;
}

@Injectable()
export class VideosService {
  constructor(
    private prisma: PrismaService,
    private mediaService: MediaService,
    private eventsVideosService: EventsVideosService,
  ) {}

  /**
   * Create a new video record with thumbnail
   */
  async create(data: {
    storagePath: string;
    thumbnailPath: string;
    userId: string;
    status?: string;
  }) {
    console.log('Creating video record:', data);

    return this.prisma.video.create({
      data: {
        ...data,
        status: data.status || 'pending',
      },
      include: {
        user: {
          select: { id: true, username: true, photo: true },
        },
      },
    });
  }

  /**
   * Get paginated video feed for an event
   */
  async getEventVideoFeed(
    eventId: string,
    options: VideoFeedOptions,
  ): Promise<VideoFeedResult> {
    const { cursor, limit, userId } = options;

    console.log(`Fetching video feed for event ${eventId}`, options);

    // Build where clause with proper typing
    interface WhereClause {
      status: string;
      events: {
        some: {
          eventId: string;
        };
      };
      userId?: string;
      id?: {
        lt: string;
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

    // Add user filter if specified
    if (userId) {
      whereClause.userId = userId;
    }

    // Add cursor condition for pagination
    if (cursor) {
      whereClause.id = {
        lt: cursor, // Get videos older than cursor
      };
    }

    try {
      // Fetch videos with pagination
      const videos = await this.prisma.video.findMany({
        where: whereClause,
        include: {
          user: {
            select: { id: true, username: true, photo: true },
          },
        },
        orderBy: {
          createdAt: 'desc', // Most recent first
        },
        take: limit + 1, // Fetch one extra to check if there are more
      });

      // Check if there are more videos
      const hasMore = videos.length > limit;
      const videosToReturn = hasMore ? videos.slice(0, limit) : videos;

      // Generate signed URLs for all videos
      const videosWithUrls: VideoWithUrls[] = await Promise.all(
        videosToReturn.map(async (video) => {
          const { videoUrl, thumbnailUrl } =
            await this.mediaService.getVideoUrls(
              video.storagePath,
              video.thumbnailPath!,
            );

          return {
            id: video.id,
            storagePath: video.storagePath,
            thumbnailPath: video.thumbnailPath!,
            videoUrl,
            thumbnailUrl,
            createdAt: video.createdAt,
            user: video.user,
          };
        }),
      );

      // Set next cursor to the ID of the last video
      const nextCursor =
        hasMore && videosToReturn.length > 0
          ? videosToReturn[videosToReturn.length - 1].id
          : null;

      return {
        videos: videosWithUrls,
        nextCursor,
        hasMore,
      };
    } catch (error) {
      console.error('Error fetching video feed:', error);
      throw error;
    }
  }

  /**
   * Find video by storage path
   */
  async findByStoragePath(storagePath: string) {
    return this.prisma.video.findUnique({
      where: { storagePath },
      include: {
        user: {
          select: { id: true, username: true, photo: true },
        },
        events: {
          include: {
            event: true,
          },
        },
      },
    });
  }

  /**
   * Find video by ID
   */
  async findById(videoId: string) {
    return this.prisma.video.findUnique({
      where: { id: videoId },
      include: {
        user: {
          select: { id: true, username: true, photo: true },
        },
        events: {
          include: {
            event: true,
          },
        },
      },
    });
  }

  /**
   * Associate video with events and mark as published
   */
  async associateWithEvents(videoId: string, eventIds: string[]) {
    console.log(`Associating video ${videoId} with events:`, eventIds);

    // Use transaction to ensure atomicity
    return this.prisma.$transaction(async (tx) => {
      // Update video status to published
      await tx.video.update({
        where: { id: videoId },
        data: { status: 'published' },
      });

      // Use the events-videos service to create associations
      await this.eventsVideosService.associateVideoWithEvents(
        videoId,
        eventIds,
      );

      // Return the updated video with all relations
      return this.findById(videoId);
    });
  }

  /**
   * Remove video from specific events
   */
  async removeFromEvents(videoId: string, eventIds: string[]) {
    console.log(`Removing video ${videoId} from events:`, eventIds);

    // Remove associations
    await this.eventsVideosService.removeVideoFromEvents(videoId, eventIds);

    // Check remaining associations
    const remainingCount =
      await this.eventsVideosService.countVideoEvents(videoId);

    // If no events remain, delete the video entirely
    if (remainingCount === 0) {
      const video = await this.findById(videoId);

      if (video) {
        await this.deleteVideoAndFiles(video);
        return { deleted: true, video };
      }
    }

    // Return updated video
    const updatedVideo = await this.findById(videoId);
    return { deleted: false, video: updatedVideo };
  }

  /**
   * Delete a video entirely (from all events and storage)
   */
  async delete(videoId: string) {
    const video = await this.findById(videoId);

    if (!video) {
      throw new Error('Video not found');
    }

    return this.deleteVideoAndFiles(video);
  }

  /**
   * Delete video and its files from storage (including thumbnail)
   */
  private async deleteVideoAndFiles(video: Video & { thumbnailPath: string }) {
    try {
      // Delete both video and thumbnail from R2
      await this.mediaService.deleteVideoFiles(
        video.storagePath,
        video.thumbnailPath,
      );

      // Delete from database (cascading will remove VideoEvent relations)
      return this.prisma.video.delete({
        where: { id: video.id },
      });
    } catch (error) {
      console.error('Error deleting video and files:', error);
      throw error;
    }
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

    console.log(`Found ${orphanedVideos.length} orphaned videos to clean up`);

    // Delete each orphaned video
    let deletedCount = 0;
    for (const video of orphanedVideos) {
      try {
        await this.deleteVideoAndFiles(
          video as Video & { thumbnailPath: string },
        );
        deletedCount++;
      } catch (error) {
        console.error(`Failed to delete orphaned video ${video.id}:`, error);
      }
    }

    return deletedCount;
  }

  /**
   * Get videos by user
   */
  async getUserVideos(userId: string) {
    return this.prisma.video.findMany({
      where: {
        userId,
        status: 'published',
      },
      include: {
        events: {
          include: {
            event: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Update video metadata
   */
  async updateVideo(
    videoId: string,
    data: {
      thumbnailPath?: string;
      status?: string;
    },
  ) {
    return this.prisma.video.update({
      where: { id: videoId },
      data,
      include: {
        user: {
          select: { id: true, username: true, photo: true },
        },
        events: {
          include: {
            event: true,
          },
        },
      },
    });
  }
}
