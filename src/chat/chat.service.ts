// src/chat/chat.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

export interface ChatWithDetails {
  id: string;
  eventId: string;
  createdAt: Date;
  updatedAt: Date;
  messages: Array<{
    id: string;
    content: string;
    createdAt: Date;
    type: string;
    sender: {
      id: string;
      username: string;
      photoThumbnailPath: string | null;
    };
  }>;
  event: {
    id: string;
    name: string | null;
  };
}

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  // Get or create chat for an event (lazy initialization)
  async getOrCreateChat(
    eventId: string,
    userId: string,
  ): Promise<ChatWithDetails> {
    // First verify user has access to this event
    await this.verifyEventAccess(eventId, userId);

    // Check if chat already exists
    const chat = await this.prisma.chat.findUnique({
      where: { eventId },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                photoThumbnailPath: true,
              },
            },
          },
        },
        event: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // If chat exists, return it
    if (chat) {
      return chat;
    }

    const newChat = await this.prisma.$transaction(async (tx) => {
      // Create the chat
      const createdChat = await tx.chat.create({
        data: {
          eventId,
        },
      });

      // Return chat with the welcome message and event details
      const chatWithDetails = await tx.chat.findUnique({
        where: { id: createdChat.id },
        include: {
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            include: {
              sender: {
                select: {
                  id: true,
                  username: true,
                  photoThumbnailPath: true,
                },
              },
            },
          },
          event: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!chatWithDetails) {
        throw new Error('Failed to create chat');
      }

      return chatWithDetails;
    });

    return newChat;
  }

  // Get messages for a chat with pagination
  async getMessages(
    eventId: string,
    userId: string,
    page: number = 1,
    limit: number = 30,
  ) {
    // Verify user has access
    await this.verifyEventAccess(eventId, userId);

    // Get chat (if it exists)
    const chat = await this.prisma.chat.findUnique({
      where: { eventId },
      select: { id: true },
    });

    if (!chat) {
      // No chat exists yet, return empty
      return {
        messages: [],
        hasMore: false,
        page: 1,
        total: 0,
      };
    }

    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { chatId: chat.id },
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
        where: { chatId: chat.id },
      }),
    ]);

    return {
      messages: messages.reverse(), // Reverse to show oldest first in UI
      hasMore: messages.length === limit,
      page,
      total,
    };
  }

  // Send a message
  async sendMessage(
    eventId: string,
    userId: string,
    content: string,
    type: string = 'text',
  ) {
    // Verify user has access
    await this.verifyEventAccess(eventId, userId);

    // Get or create chat (this will create chat if it doesn't exist)
    const chat = await this.getOrCreateChat(eventId, userId);

    // Create the message
    const message = await this.prisma.message.create({
      data: {
        content: content.trim(),
        type,
        chatId: chat.id,
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

    // Update chat's updatedAt timestamp
    await this.prisma.chat.update({
      where: { id: chat.id },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  // Get chat preview for the event detail page
  async getChatPreview(eventId: string, userId: string) {
    try {
      // Verify user has access
      await this.verifyEventAccess(eventId, userId);

      // Get chat if it exists
      const chat = await this.prisma.chat.findUnique({
        where: { eventId },
        include: {
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            include: {
              sender: {
                select: {
                  id: true,
                  username: true,
                  photoThumbnailPath: true,
                },
              },
            },
          },
        },
      });

      if (!chat) {
        return {
          hasChat: false,
          hasMessages: false,
          messageCount: 0,
          lastMessage: null,
        };
      }

      const messageCount = await this.prisma.message.count({
        where: { chatId: chat.id },
      });

      const lastMessage = chat.messages[0];

      return {
        hasChat: true,
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
        hasChat: false,
        hasMessages: false,
        messageCount: 0,
        lastMessage: null,
      };
    }
  }

  // Delete a chat (admin only)
  async deleteChat(eventId: string, userId: string) {
    // Verify user is admin of the event
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { adminId: true },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    if (event.adminId !== userId) {
      throw new ForbiddenException('Only event admin can delete chat');
    }

    // Delete chat if it exists (will cascade delete messages)
    const chat = await this.prisma.chat.findUnique({
      where: { eventId },
    });

    if (chat) {
      await this.prisma.chat.delete({
        where: { id: chat.id },
      });
    }

    return { message: 'Chat deleted successfully' };
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
