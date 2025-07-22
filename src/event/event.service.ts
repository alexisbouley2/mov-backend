import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { MediaService } from '@/media/media.service';
import { FCMService } from '@/push-notification/fcm.service';
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
  AcceptInviteResponse,
} from '@movapp/types';
import { VideoService } from '@/video/video.service';
import { randomBytes } from 'crypto';
import { MessageService } from '@/message/message.service';

const PARTICIPANTS_PREVIEW_LIMIT = 6;

@Injectable()
export class EventService {
  private readonly logger = new Logger(EventService.name);

  constructor(
    private prisma: PrismaService,
    private mediaService: MediaService,
    private videoService: VideoService,
    private fcmService: FCMService,
    private messageService: MessageService,
  ) {}

  async create(data: CreateEventRequest): Promise<Event> {
    const event = await this.prisma.event.create({ data });

    // Add admin as participant (confirmed by default)
    await this.prisma.eventParticipant.create({
      data: {
        userId: data.adminId,
        eventId: event.id,
        confirmed: true,
      },
    });

    return {
      ...event,
      coverImageUrl: null,
      coverThumbnailUrl: null,
    };
  }

  async findOne(id: string, userId: string): Promise<EventWithDetails> {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        participants: {
          include: { user: true },
          take: PARTICIPANTS_PREVIEW_LIMIT,
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
        _count: {
          select: { participants: true },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const eventParticipant = await this.prisma.eventParticipant.findUnique({
      where: {
        userId_eventId: {
          userId: userId,
          eventId: id,
        },
      },
    });

    if (!eventParticipant) {
      throw new ForbiddenException('You do not have access to this event');
    }

    const isParticipant = eventParticipant.confirmed;

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

    // Get last message
    const lastMessage = await this.prisma.message.findFirst({
      where: { eventId: event.id },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            profileThumbnailPath: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Add photo thumbnail URL for the last message sender
    let lastMessageSenderThumbnailUrl: string | null = null;
    if (lastMessage?.sender.profileThumbnailPath) {
      lastMessageSenderThumbnailUrl =
        await this.mediaService.getPresignedDownloadUrl(
          lastMessage.sender.profileThumbnailPath,
        );
    }

    return {
      ...event,
      coverImageUrl,
      coverThumbnailUrl,
      participants: participantsWithProfileThumbnailUrls,
      lastMessage: lastMessage
        ? {
            ...lastMessage,
            sender: {
              ...lastMessage.sender,
              profileThumbnailUrl: lastMessageSenderThumbnailUrl,
            },
          }
        : null,
      currentUserConfirmed: isParticipant,
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
          take: PARTICIPANTS_PREVIEW_LIMIT,
          orderBy: { joinedAt: 'desc' },
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
    confirmed?: boolean,
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

    interface WhereClause {
      eventId: string;
      confirmed?: boolean;
    }

    // Add confirmed filter if provided
    const whereClause: WhereClause = { eventId };
    if (typeof confirmed === 'boolean') {
      whereClause.confirmed = confirmed;
    }

    const [participants, total] = await Promise.all([
      this.prisma.eventParticipant.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              profileThumbnailPath: true,
            },
          },
        },
        orderBy: [{ user: { username: 'asc' } }, { joinedAt: 'desc' }],
        take: limit,
        skip,
      }),
      this.prisma.eventParticipant.count({
        where: whereClause,
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
  ): Promise<AcceptInviteResponse> {
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
          eventId: null,
        };
      }

      if (invite.expiresAt < new Date()) {
        return {
          success: false,
          message: 'Invite has expired',
          eventId: null,
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
          success: true,
          message: 'You are already a participant of this event',
          eventId: invite.eventId,
        };
      }

      // Add user as participant (not confirmed by default)
      await tx.eventParticipant.create({
        data: {
          userId,
          eventId: invite.eventId,
          confirmed: false,
        },
      });

      return {
        success: true,
        message: 'Successfully joined the event',
        eventId: invite.eventId,
      };
    });
  }

  async updateParticipantConfirmation(
    eventId: string,
    userId: string,
    confirmed: boolean,
  ): Promise<{ message: string }> {
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

    await this.prisma.eventParticipant.update({
      where: {
        userId_eventId: {
          userId,
          eventId,
        },
      },
      data: { confirmed },
    });

    return { message: 'Participant confirmation status updated successfully' };
  }

  async addParticipant(
    eventId: string,
    participantUserId: string,
    userId: string,
  ): Promise<{ message: string }> {
    // Find event and verify user is a participant
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        participants: {
          where: { userId: userId },
          select: { userId: true },
        },
      },
    });

    if (!event) {
      throw new Error('Event not found');
    }

    // Check if the requesting user is a participant of the event
    if (event.participants.length === 0) {
      throw new Error('You must be a participant of this event to add others');
    }

    // Check if the user to be added is already a participant
    const existingParticipant = await this.prisma.eventParticipant.findUnique({
      where: {
        userId_eventId: {
          userId: participantUserId,
          eventId,
        },
      },
    });

    if (existingParticipant) {
      return { message: 'User is already a participant of this event' };
    }

    // Get user information for notifications
    const [adderUser, addedUser] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { username: true },
      }),
      this.prisma.user.findUnique({
        where: { id: participantUserId },
        select: { username: true },
      }),
    ]);

    if (!addedUser) {
      throw new Error('User to be added not found');
    }

    // Add user as participant (not confirmed by default)
    await this.prisma.eventParticipant.create({
      data: {
        userId: participantUserId,
        eventId,
        confirmed: false,
      },
    });

    // Send push notification in background (don't await)
    this.fcmService
      .sendParticipantAddedNotification({
        eventId: event.id,
        addedUserId: participantUserId,
        addedUserName: addedUser.username,
        adderUserId: userId,
        adderUserName: adderUser?.username || 'Unknown',
        eventName: event.name || undefined,
      })
      .catch((error) => {
        this.logger.error(
          'Failed to send participant added push notifications:',
          error,
        );
      });

    return { message: 'Participant added successfully' };
  }

  async deleteParticipant(
    eventId: string,
    participantUserId: string,
    adminId: string,
  ): Promise<{ message: string }> {
    // Find event and verify admin
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        admin: true,
        participants: {
          where: { userId: participantUserId },
          include: { user: true },
        },
      },
    });

    if (!event) {
      throw new Error('Event not found');
    }

    if (event.adminId !== adminId) {
      throw new Error('Only admin can delete participants');
    }

    // Check if trying to delete admin
    if (participantUserId === adminId) {
      throw new Error('Admin cannot remove themselves from the event');
    }

    // Check if participant exists
    if (event.participants.length === 0) {
      throw new Error('Participant not found in this event');
    }

    // Delete the participant
    await this.prisma.eventParticipant.delete({
      where: {
        userId_eventId: {
          userId: participantUserId,
          eventId,
        },
      },
    });

    return { message: 'Participant removed successfully' };
  }
}
