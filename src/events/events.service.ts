import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from '../media/media.service';

@Injectable()
export class EventsService {
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
    photoStoragePath?: string;
    photoThumbnailPath?: string;
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

  async findAll() {
    const events = await this.prisma.event.findMany({
      include: {
        admin: true,
        participants: { include: { user: true } },
        videos: true,
      },
    });

    // Add photo URLs to each event
    return Promise.all(
      events.map(async (event) => {
        const photoUrls = await this.mediaService.getEventPhotoUrls({
          photoStoragePath: event.photoStoragePath ?? undefined,
          photoThumbnailPath: event.photoThumbnailPath ?? undefined,
        });
        return { ...event, ...photoUrls };
      }),
    );
  }
  async findOne(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        admin: true,
        participants: { include: { user: true } },
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

    // Add photo URLs for event
    const photoUrls = await this.mediaService.getEventPhotoUrls({
      photoStoragePath: event.photoStoragePath ?? undefined,
      photoThumbnailPath: event.photoThumbnailPath ?? undefined,
    });

    // Add photo URLs for admin
    const adminPhotoUrls = await this.mediaService.getUserPhotoUrls({
      photoThumbnailPath: event.admin.photoThumbnailPath ?? undefined,
      photoStoragePath: event.admin.photoStoragePath ?? undefined,
    });

    // Add photo URLs for participants
    const participantsWithPhotos = await Promise.all(
      event.participants.map(async (participant) => {
        const userPhotoUrls = await this.mediaService.getUserPhotoUrls({
          photoThumbnailPath: participant.user.photoThumbnailPath ?? undefined,
          photoStoragePath: participant.user.photoStoragePath ?? undefined,
        });
        return {
          ...participant,
          user: {
            ...participant.user,
            ...userPhotoUrls,
          },
        };
      }),
    );

    return {
      ...event,
      ...photoUrls,
      admin: { ...event.admin, ...adminPhotoUrls },
      participants: participantsWithPhotos,
    };
  }

  async update(
    id: string,
    data: {
      name?: string;
      information?: string;
      date?: Date;
      location?: string;
      photoStoragePath?: string;
      photoThumbnailPath?: string;
    },
  ) {
    // Get current event to check for existing photos
    const currentEvent = await this.prisma.event.findUnique({
      where: { id },
      select: { photoStoragePath: true, photoThumbnailPath: true },
    });

    // Delete old photos if they exist and we're updating with new ones
    if (
      currentEvent?.photoStoragePath &&
      currentEvent?.photoThumbnailPath &&
      (data.photoStoragePath || data.photoThumbnailPath)
    ) {
      try {
        await this.mediaService.deletePhotoFiles(
          currentEvent.photoStoragePath,
          currentEvent.photoThumbnailPath,
        );
      } catch (error) {
        console.error('Failed to delete old event photos:', error);
      }
    }

    const updatedEvent = await this.prisma.event.update({
      where: { id },
      data,
    });

    // Add photo URLs
    const photoUrls = await this.mediaService.getEventPhotoUrls({
      photoStoragePath: updatedEvent.photoStoragePath ?? undefined,
      photoThumbnailPath: updatedEvent.photoThumbnailPath ?? undefined,
    });

    return { ...updatedEvent, ...photoUrls };
  }

  async remove(id: string) {
    // Get event to clean up photos
    const event = await this.prisma.event.findUnique({
      where: { id },
      select: { photoStoragePath: true, photoThumbnailPath: true },
    });

    // Delete photos if they exist
    if (event?.photoStoragePath && event?.photoThumbnailPath) {
      try {
        await this.mediaService.deletePhotoFiles(
          event.photoStoragePath,
          event.photoThumbnailPath,
        );
      } catch (error) {
        console.error('Failed to delete event photos during removal:', error);
      }
    }

    return this.prisma.event.delete({ where: { id } });
  }

  async getUserEvents(userId: string) {
    const events = await this.prisma.event.findMany({
      where: {
        OR: [{ adminId: userId }, { participants: { some: { userId } } }],
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

    // Add photo URLs to each event
    const eventsWithPhotos = await Promise.all(
      events.map(async (event) => {
        const photoUrls = await this.mediaService.getEventPhotoUrls({
          photoStoragePath: event.photoStoragePath ?? undefined,
          photoThumbnailPath: event.photoThumbnailPath ?? undefined,
        });
        return { ...event, ...photoUrls };
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

  async addParticipant(eventId: string, userId: string) {
    try {
      // Check if participant already exists
      const existingParticipant = await this.prisma.eventParticipant.findUnique(
        {
          where: {
            userId_eventId: {
              userId,
              eventId,
            },
          },
        },
      );

      if (existingParticipant) {
        throw new Error('User is already a participant');
      }

      // Add the participant
      await this.prisma.eventParticipant.create({
        data: {
          userId,
          eventId,
        },
      });

      return { message: 'Participant added successfully' };
    } catch (error) {
      throw new Error(`Failed to add participant: ${error}`);
    }
  }

  async removeParticipant(eventId: string, userId: string) {
    try {
      // Check if participant exists
      const existingParticipant = await this.prisma.eventParticipant.findUnique(
        {
          where: {
            userId_eventId: {
              userId,
              eventId,
            },
          },
        },
      );

      if (!existingParticipant) {
        throw new Error('User is not a participant');
      }

      // Remove the participant
      await this.prisma.eventParticipant.delete({
        where: {
          userId_eventId: {
            userId,
            eventId,
          },
        },
      });

      return { message: 'Participant removed successfully' };
    } catch (error) {
      throw new Error(`Failed to remove participant: ${error}`);
    }
  }
}
