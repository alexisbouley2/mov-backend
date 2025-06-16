import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { EventsVideosService } from '../events-videos/events-videos.service';
import { Video } from '../../generated/prisma';

@Injectable()
export class VideosService {
  constructor(
    private prisma: PrismaService,
    private mediaService: MediaService,
    private eventsVideosService: EventsVideosService,
  ) {}

  /**
   * Create a new video record
   */
  async create(data: {
    storagePath: string;
    userId: string;
    thumbnailPath?: string;
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
   * Delete video and its files from storage
   */
  private async deleteVideoAndFiles(video: Video) {
    // Delete from R2
    await this.mediaService.deleteFile(video.storagePath);
    if (video.thumbnailPath) {
      await this.mediaService.deleteFile(video.thumbnailPath);
    }

    // Delete from database (cascading will remove VideoEvent relations)
    return this.prisma.video.delete({
      where: { id: video.id },
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

    console.log(`Found ${orphanedVideos.length} orphaned videos to clean up`);

    // Delete each orphaned video
    let deletedCount = 0;
    for (const video of orphanedVideos) {
      try {
        await this.deleteVideoAndFiles(video);
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
