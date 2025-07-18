// src/message/message.service.ts
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
  SendMessageResponse,
  EventMessagesResponse,
  MessagePreviewResponse,
} from '@movapp/types';

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);

  constructor(
    private prisma: PrismaService,
    private mediaService: MediaService,
    private fcmService: FCMService,
  ) {}

  // Get messages for an event with pagination
  async getMessages(
    eventId: string,
    userId: string,
    page: number = 1,
    limit: number = 30,
  ): Promise<EventMessagesResponse> {
    const event = await this.verifyEventAccess(eventId, userId);

    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { eventId },
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
        take: limit,
        skip,
      }),
      this.prisma.message.count({
        where: { eventId },
      }),
    ]);

    // Add photo thumbnail URLs for message senders
    const messagesWithThumbnails = await Promise.all(
      messages.map(async (message) => {
        let senderProfileThumbnailUrl: string | null = null;
        if (message.sender.profileThumbnailPath) {
          senderProfileThumbnailUrl =
            await this.mediaService.getPresignedDownloadUrl(
              message.sender.profileThumbnailPath,
            );
        }
        return {
          ...message,
          sender: {
            ...message.sender,
            profileThumbnailUrl: senderProfileThumbnailUrl,
          },
        };
      }),
    );

    return {
      messages: messagesWithThumbnails.reverse(), // Reverse to show oldest first in UI
      hasMore: messages.length === limit,
      page,
      total,
      event: {
        id: event.id,
        name: event.name,
      },
    };
  }

  async sendMessage(
    eventId: string,
    userId: string,
    content: string,
    type: string = 'text',
  ): Promise<SendMessageResponse> {
    const event = await this.verifyEventAccess(eventId, userId);

    const message = await this.prisma.message.create({
      data: {
        content: content.trim(),
        type,
        eventId,
        senderId: userId,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            profileThumbnailPath: true,
          },
        },
      },
    });

    // Add photo thumbnail URL for the sender
    let senderProfileThumbnailUrl: string | null = null;
    if (message.sender.profileThumbnailPath) {
      senderProfileThumbnailUrl =
        await this.mediaService.getPresignedDownloadUrl(
          message.sender.profileThumbnailPath,
        );
    }

    // Envoyer les notifications push en arrière-plan (ne pas attendre)
    this.fcmService
      .sendNewMessageNotification({
        eventId: event.id,
        senderId: userId,
        senderName: message.sender.username,
        messageContent: content.trim(),
        eventName: event.name || undefined,
      })
      .catch((error) => {
        this.logger.error('Failed to send push notifications:', error);
      });

    return {
      ...message,
      sender: {
        ...message.sender,
        profileThumbnailUrl: senderProfileThumbnailUrl,
      },
    };
  }

  // Get message preview for the event detail page
  async getMessagePreview(
    eventId: string,
    userId: string,
  ): Promise<MessagePreviewResponse> {
    try {
      await this.verifyEventAccess(eventId, userId);

      // Get total message count
      const messageCount = await this.prisma.message.count({
        where: { eventId },
      });

      // Get last message
      const lastMessage = await this.prisma.message.findFirst({
        where: { eventId },
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
        hasMessages: messageCount > 0,
        messageCount,
        lastMessage: lastMessage
          ? {
              content: lastMessage.content,
              sender: {
                ...lastMessage.sender,
                profileThumbnailUrl: lastMessageSenderThumbnailUrl,
              },
              createdAt: lastMessage.createdAt,
              type: lastMessage.type,
            }
          : null,
      };
    } catch (error) {
      // If user doesn't have access, return default
      this.logger.error(error);
      return {
        hasMessages: false,
        messageCount: 0,
        lastMessage: null,
      };
    }
  }

  // Get a single message with sender information
  async getMessageById(
    messageId: string,
    userId: string,
  ): Promise<SendMessageResponse | null> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            profileThumbnailPath: true,
          },
        },
        event: {
          include: {
            participants: {
              where: { userId },
              select: { userId: true },
            },
          },
        },
      },
    });

    if (!message) {
      return null;
    }

    // Verify user has access to the event
    const hasAccess = message.event.participants.length > 0;
    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this message');
    }

    // Add photo thumbnail URL for the sender
    let senderProfileThumbnailUrl: string | null = null;
    if (message.sender.profileThumbnailPath) {
      senderProfileThumbnailUrl =
        await this.mediaService.getPresignedDownloadUrl(
          message.sender.profileThumbnailPath,
        );
    }

    return {
      ...message,
      sender: {
        ...message.sender,
        profileThumbnailUrl: senderProfileThumbnailUrl,
      },
    };
  }

  // Helper method to verify user has access to event
  private async verifyEventAccess(eventId: string, userId: string) {
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
      throw new NotFoundException('Event not found');
    }

    const hasAccess = event.participants.length > 0;

    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this event');
    }

    return event;
  }
}
