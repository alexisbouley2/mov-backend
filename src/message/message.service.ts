// src/message/messages.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

export interface MessageDetails {
  id: string;
  content: string;
  createdAt: Date;
  type: string;
  sender: {
    id: string;
    username: string;
    photoThumbnailPath: string | null;
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
  constructor(private prisma: PrismaService) {}

  // Get messages for an event with pagination
  async getMessages(
    eventId: string,
    userId: string,
    page: number = 1,
    limit: number = 30,
  ): Promise<EventMessagesResponse> {
    // Verify user has access
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
              photoThumbnailPath: true,
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

  // Send a message to an event
  async sendMessage(
    eventId: string,
    userId: string,
    content: string,
    type: string = 'text',
  ): Promise<MessageDetails> {
    // Verify user has access
    await this.verifyEventAccess(eventId, userId);

    // Create the message directly linked to the event
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
            photoThumbnailPath: true,
          },
        },
      },
    });

    return message;
  }

  // Get message preview for the event detail page
  async getMessagePreview(eventId: string, userId: string) {
    try {
      // Verify user has access
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
              photoThumbnailPath: true,
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
      console.error(error);
      return {
        hasMessages: false,
        messageCount: 0,
        lastMessage: null,
      };
    }
  }

  // Delete all messages for an event (admin only)
  async deleteEventMessages(eventId: string, userId: string) {
    // Verify user is admin of the event
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { adminId: true },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    if (event.adminId !== userId) {
      throw new ForbiddenException('Only event admin can delete messages');
    }

    // Delete all messages for this event
    const deletedCount = await this.prisma.message.deleteMany({
      where: { eventId },
    });

    return {
      message: 'Messages deleted successfully',
      deletedCount: deletedCount.count,
    };
  }

  // Delete a specific message (sender or admin only)
  async deleteMessage(messageId: string, userId: string) {
    // Get message with event info
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        event: {
          select: { adminId: true },
        },
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Check if user is the sender or event admin
    const canDelete =
      message.senderId === userId || message.event.adminId === userId;

    if (!canDelete) {
      throw new ForbiddenException(
        'You can only delete your own messages or be an event admin',
      );
    }

    await this.prisma.message.delete({
      where: { id: messageId },
    });

    return { message: 'Message deleted successfully' };
  }

  // Get recent messages across all user's events (for notifications, etc.)
  async getUserRecentMessages(userId: string, limit: number = 10) {
    // Get all events where user is participant or admin
    const userEvents = await this.prisma.event.findMany({
      where: {
        OR: [{ adminId: userId }, { participants: { some: { userId } } }],
      },
      select: { id: true },
    });

    const eventIds = userEvents.map((event) => event.id);

    if (eventIds.length === 0) {
      return [];
    }

    // Get recent messages from user's events
    const messages = await this.prisma.message.findMany({
      where: {
        eventId: { in: eventIds },
        senderId: { not: userId }, // Exclude user's own messages
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            photoThumbnailPath: true,
          },
        },
        event: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return messages;
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

    const hasAccess = event.adminId === userId || event.participants.length > 0;

    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this event');
    }

    return event;
  }
}
