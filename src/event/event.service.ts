import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { MediaService } from '@/media/media.service';
import { Logger } from '@nestjs/common';
import {
  CreateEventRequest,
  UpdateEventRequest,
  Event,
  CategorizedEventsResponse,
  EventParticipantsResponse,
  EventWithDetails,
  DeleteEventResponse,
  GenerateInviteResponse,
  ValidateInviteResponse,
} from '@movapp/types';
import { VideoService } from '@/video/video.service';
import { randomBytes } from 'crypto';

@Injectable()
export class EventService {
  private readonly logger = new Logger(EventService.name);

  constructor(
    private prisma: PrismaService,
    private mediaService: MediaService,
    private videoService: VideoService,
  ) {}

  async create(data: CreateEventRequest): Promise<Event> {
    const event = await this.prisma.event.create({ data });

    // Add admin as participant
    await this.prisma.eventParticipant.create({
      data: {
        userId: data.adminId,
        eventId: event.id,
      },
    });

    return {
      ...event,
      coverImageUrl: null,
      coverThumbnailUrl: null,
    };
  }

  async findOne(id: string): Promise<EventWithDetails | null> {
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

    let coverThumbnailUrl: string | null = null;
    if (event.coverThumbnailPath) {
      coverThumbnailUrl = await this.mediaService.getPresignedDownloadUrl(
        event.coverThumbnailPath,
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
      coverThumbnailUrl,
      admin: { ...event.admin, profileThumbnailUrl: adminProfileThumbnailUrl },
      participants: participantsWithProfileThumbnailUrls,
    };
  }

  async update(
    id: string,
    data: UpdateEventRequest,
  ): Promise<{ message: string }> {
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

  async getUserEvents(userId: string): Promise<CategorizedEventsResponse> {
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

    // Add photo thumbnail URLs to each event and participant thumbnails
    const eventsWithPhotos = await Promise.all(
      events.map(async (event) => {
        let coverThumbnailUrl: string | null = null;
        if (event.coverThumbnailPath) {
          coverThumbnailUrl = await this.mediaService.getPresignedDownloadUrl(
            event.coverThumbnailPath,
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
          admin: {
            ...event.admin,
            profileThumbnailUrl: null,
            profileImageUrl: null,
          },
          coverImageUrl: null,
          coverThumbnailUrl,
          participants: participantsWithProfileThumbnailUrls,
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
  ): Promise<EventParticipantsResponse> {
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

  async delete(eventId: string, userId: string): Promise<DeleteEventResponse> {
    // Find event and check admin
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        admin: true,
        videos: {
          include: {
            video: {
              include: {
                events: true,
              },
            },
          },
        },
      },
    });
    if (!event) throw new Error('Event not found');
    if (event.adminId !== userId)
      throw new Error('Only admin can delete event');

    // Delete event cover files from R2
    const filesToDelete: string[] = [];
    if (event.coverImagePath) filesToDelete.push(event.coverImagePath);
    if (event.coverThumbnailPath) filesToDelete.push(event.coverThumbnailPath);
    if (filesToDelete.length > 0) {
      try {
        await this.mediaService.deleteMultipleFiles(filesToDelete);
      } catch (err) {
        this.logger.error('Failed to delete event cover files:', err);
      }
    }

    // For each video, if this is the last event, delete the video and its files
    for (const videoEvent of event.videos) {
      const video = videoEvent.video;
      if (video.events.length === 1) {
        // Only associated with this event
        try {
          await this.videoService.delete(video.id);
        } catch (err) {
          this.logger.error(`Failed to delete video ${video.id}:`, err);
        }
      }
    }

    // Delete the event (cascade will handle EventParticipant and VideoEvent)
    await this.prisma.event.delete({ where: { id: eventId } });

    return { message: 'Event deleted successfully' };
  }

  async generateInvite(
    eventId: string,
    userId: string,
  ): Promise<GenerateInviteResponse> {
    // Verify user is a participant of the event (not just admin)
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

    // Check if user is a participant (not just admin)
    const isParticipant = event.participants.length > 0;
    if (!isParticipant) {
      throw new Error('You must be a participant to generate invites');
    }

    // Generate a secure random token
    const token = randomBytes(32).toString('hex');

    // Set expiration to 1 day from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 1);

    // Create the invite
    await this.prisma.eventInvite.create({
      data: {
        token,
        eventId,
        createdBy: userId,
        expiresAt,
      },
    });

    return {
      token,
    };
  }

  async validateInvite(token: string): Promise<ValidateInviteResponse> {
    const invite = await this.prisma.eventInvite.findUnique({
      where: { token },
      select: {
        expiresAt: true,
      },
    });

    if (!invite) {
      return {
        valid: false,
        error: 'Invalid invite token',
      };
    }

    if (invite.expiresAt < new Date()) {
      return {
        valid: false,
        error: 'Invite has expired',
      };
    }

    return {
      valid: true,
      error: null,
    };
  }

  async acceptInvite(
    token: string,
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.prisma.$transaction(async (tx) => {
      // Find and validate the invite
      const invite = await tx.eventInvite.findUnique({
        where: { token },
        include: {
          event: {
            select: { id: true },
          },
        },
      });

      if (!invite) {
        return {
          success: false,
          message: 'Invalid invite token',
        };
      }

      if (invite.expiresAt < new Date()) {
        return {
          success: false,
          message: 'Invite has expired',
        };
      }

      // Check if user is already a participant
      const existingParticipant = await tx.eventParticipant.findUnique({
        where: {
          userId_eventId: {
            userId,
            eventId: invite.eventId,
          },
        },
      });

      if (existingParticipant) {
        return {
          success: false,
          message: 'You are already a participant of this event',
        };
      }

      // Add user as participant (no need to mark invite as used since we allow multiple uses)
      await tx.eventParticipant.create({
        data: {
          userId,
          eventId: invite.eventId,
        },
      });

      return {
        success: true,
        message: 'Successfully joined the event',
      };
    });
  }
}
