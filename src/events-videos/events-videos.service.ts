import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EventsVideosService {
  constructor(private prisma: PrismaService) {}

  /**
   * Associate a video with multiple events
   */
  async associateVideoWithEvents(videoId: string, eventIds: string[]) {
    return this.prisma.videoEvent.createMany({
      data: eventIds.map((eventId) => ({
        videoId,
        eventId,
      })),
      skipDuplicates: true,
    });
  }

  /**
   * Remove video from specific events
   */
  async removeVideoFromEvents(videoId: string, eventIds: string[]) {
    return this.prisma.videoEvent.deleteMany({
      where: {
        videoId,
        eventId: {
          in: eventIds,
        },
      },
    });
  }

  /**
   * Get all events for a video
   */
  async getVideoEvents(videoId: string) {
    return this.prisma.videoEvent.findMany({
      where: { videoId },
      include: {
        event: true,
      },
    });
  }

  /**
   * Get all videos for an event
   */
  async getEventVideos(eventId: string, includeUserData = true) {
    const videoEvents = await this.prisma.videoEvent.findMany({
      where: {
        eventId,
        video: {
          status: 'published',
        },
      },
      include: {
        video: {
          include: includeUserData
            ? {
                user: {
                  select: {
                    id: true,
                    username: true,
                    photoThumbnailPath: true,
                  },
                },
              }
            : undefined,
        },
      },
      orderBy: {
        addedAt: 'desc',
      },
    });

    return videoEvents.map((ve) => ve.video);
  }

  /**
   * Count events for a video
   */
  async countVideoEvents(videoId: string): Promise<number> {
    return this.prisma.videoEvent.count({
      where: { videoId },
    });
  }

  /**
   * Check if video is in event
   */
  async isVideoInEvent(videoId: string, eventId: string): Promise<boolean> {
    const count = await this.prisma.videoEvent.count({
      where: {
        videoId,
        eventId,
      },
    });

    return count > 0;
  }

  /**
   * Get videos for multiple events
   */
  async getVideosForEvents(eventIds: string[]) {
    return this.prisma.videoEvent.findMany({
      where: {
        eventId: {
          in: eventIds,
        },
        video: {
          status: 'published',
        },
      },
      include: {
        video: {
          include: {
            user: {
              select: { id: true, username: true, photoThumbnailPath: true },
            },
          },
        },
        event: true,
      },
    });
  }

  /**
   * Remove all associations for a video
   */
  async removeAllVideoAssociations(videoId: string) {
    return this.prisma.videoEvent.deleteMany({
      where: { videoId },
    });
  }
}
