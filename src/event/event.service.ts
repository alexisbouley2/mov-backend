import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { MediaService } from '@/media/media.service';
import { Logger } from '@nestjs/common';

@Injectable()
export class EventService {
  private readonly logger = new Logger(EventService.name);

  constructor(
    private prisma: PrismaService,
    private mediaService: MediaService,
  ) {}

  async create(data: {
    name: string;
    information?: string;
    date: Date;
    location?: string;
    adminId: string;
    coverImagePath?: string;
    coverThumbnailPath?: string;
  }) {
    const event = await this.prisma.event.create({ data });

    // Add admin as participant
    await this.prisma.eventParticipant.create({
      data: {
        userId: data.adminId,
        eventId: event.id,
      },
    });

    return event;
  }

  async findOne(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        admin: true,
        participants: {
          include: { user: true },
          take: 6,
          orderBy: { joinedAt: 'desc' },
        },
        videos: {
          include: {
            video: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    if (!event) return null;

    // Add photo URL for event
    let coverImageUrl: string | null = null;
    if (event.coverImagePath) {
      coverImageUrl = await this.mediaService.getPresignedDownloadUrl(
        event.coverImagePath,
      );
    }

    // Add photo URLs for admin
    let adminProfileThumbnailUrl: string | null = null;
    if (event.admin.profileThumbnailPath) {
      adminProfileThumbnailUrl =
        await this.mediaService.getPresignedDownloadUrl(
          event.admin.profileThumbnailPath,
        );
    }

    // Add photo thumbnail URLs for participants
    const participantsWithProfileThumbnailUrls = await Promise.all(
      event.participants.map(async (participant) => {
        let userProfileThumbnailUrl: string | null = null;
        if (participant.user.profileThumbnailPath) {
          userProfileThumbnailUrl =
            await this.mediaService.getPresignedDownloadUrl(
              participant.user.profileThumbnailPath,
            );
        }
        return {
          ...participant,
          user: {
            ...participant.user,
            profileThumbnailUrl: userProfileThumbnailUrl,
          },
        };
      }),
    );

    return {
      ...event,
      coverImageUrl,
      admin: { ...event.admin, profileThumbnailUrl: adminProfileThumbnailUrl },
      participants: participantsWithProfileThumbnailUrls,
    };
  }

  async update(
    id: string,
    data: {
      name?: string;
      information?: string;
      date?: Date;
      location?: string;
      coverImagePath?: string;
      coverThumbnailPath?: string;
    },
  ) {
    // Get current event to check for existing photos
    const currentEvent = await this.prisma.event.findUnique({
      where: { id },
      select: { coverImagePath: true, coverThumbnailPath: true },
    });

    // Delete old photos if they exist and we're updating with new ones
    if (
      currentEvent?.coverImagePath &&
      currentEvent?.coverThumbnailPath &&
      (data.coverImagePath || data.coverThumbnailPath)
    ) {
      try {
        await this.mediaService.deleteMultipleFiles([
          currentEvent.coverImagePath,
          currentEvent.coverThumbnailPath,
        ]);
      } catch (error) {
        this.logger.error('Failed to delete old event photos:', error);
      }
    }

    await this.prisma.event.update({
      where: { id },
      data,
    });

    return { message: 'Event updated successfully' };
  }

  async getUserEvents(userId: string) {
    const events = await this.prisma.event.findMany({
      where: {
        participants: { some: { userId } },
      },
      include: {
        admin: true,
        participants: {
          include: { user: true },
        },
        _count: {
          select: { videos: true },
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    // Add photo thumbnail URLs to each event
    const eventsWithPhotos = await Promise.all(
      events.map(async (event) => {
        let coverThumbnailUrl: string | null = null;
        if (event.coverThumbnailPath) {
          coverThumbnailUrl = await this.mediaService.getPresignedDownloadUrl(
            event.coverThumbnailPath,
          );
        }
        return {
          ...event,
          coverThumbnailUrl,
        };
      }),
    );

    // Categorize events based on date + 24h window
    const now = new Date();

    const categorized = {
      past: eventsWithPhotos.filter((event) => {
        const eventDate = new Date(event.date);
        const eventEnd = new Date(eventDate.getTime() + 24 * 60 * 60 * 1000); // date + 24h
        return eventEnd < now; // date + 24h is already passed
      }),
      current: eventsWithPhotos.filter((event) => {
        const eventDate = new Date(event.date);
        const eventEnd = new Date(eventDate.getTime() + 24 * 60 * 60 * 1000); // date + 24h
        return eventDate <= now && now < eventEnd; // date <= now < date + 24h
      }),
      planned: eventsWithPhotos.filter((event) => {
        const eventDate = new Date(event.date);
        return now < eventDate; // now < date
      }),
    };

    return categorized;
  }

  async getEventParticipants(
    eventId: string,
    userId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    // Verify user has access to event
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        participants: {
          where: { userId },
          select: { userId: true },
        },
      },
    });

    if (!event) {
      throw new Error('Event not found');
    }

    const hasAccess = event.participants.length > 0;
    if (!hasAccess) {
      throw new Error('You do not have access to this event');
    }

    const skip = (page - 1) * limit;

    const [participants, total] = await Promise.all([
      this.prisma.eventParticipant.findMany({
        where: { eventId },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              profileThumbnailPath: true,
            },
          },
        },
        orderBy: { joinedAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.eventParticipant.count({
        where: { eventId },
      }),
    ]);

    // Add photo thumbnail URLs for participants
    const participantsWithThumbnails = await Promise.all(
      participants.map(async (participant) => {
        let profileThumbnailUrl: string | null = null;
        if (participant.user.profileThumbnailPath) {
          profileThumbnailUrl = await this.mediaService.getPresignedDownloadUrl(
            participant.user.profileThumbnailPath,
          );
        }
        return {
          ...participant,
          user: {
            ...participant.user,
            profileThumbnailUrl,
          },
        };
      }),
    );

    return {
      participants: participantsWithThumbnails,
      hasMore: participants.length === limit,
      page,
      total,
      event: {
        id: event.id,
        name: event.name,
      },
    };
  }
}
