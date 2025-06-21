// src/message/message.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Logger } from '@nestjs/common';

export interface MessageDetails {
  id: string;
  content: string;
  createdAt: Date;
  type: string;
  sender: {
    id: string;
    username: string;
    profileThumbnailPath: string | null;
  };
}

export interface EventMessagesResponse {
  messages: MessageDetails[];
  hasMore: boolean;
  page: number;
  total: number;
  event: {
    id: string;
    name: string | null;
  };
}

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);

  constructor(private prisma: PrismaService) {}

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

    return {
      messages: messages.reverse(), // Reverse to show oldest first in UI
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
  ): Promise<MessageDetails> {
    await this.verifyEventAccess(eventId, userId);

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

    return message;
  }

  // Get message preview for the event detail page
  async getMessagePreview(eventId: string, userId: string) {
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

      return {
        hasMessages: messageCount > 0,
        messageCount,
        lastMessage: lastMessage
          ? {
              content: lastMessage.content,
              sender: lastMessage.sender,
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
