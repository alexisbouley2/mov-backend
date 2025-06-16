// src/chat/chat.controller.ts
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // Get or create chat for an event (when user opens chat)
  @Get('event/:eventId/user/:userId')
  getOrCreateChat(
    @Param('eventId') eventId: string,
    @Param('userId') userId: string,
  ) {
    return this.chatService.getOrCreateChat(eventId, userId);
  }

  // Get chat preview for event detail page
  @Get('event/:eventId/preview/user/:userId')
  getChatPreview(
    @Param('eventId') eventId: string,
    @Param('userId') userId: string,
  ) {
    return this.chatService.getChatPreview(eventId, userId);
  }

  // Get messages with pagination
  @Get('event/:eventId/messages/user/:userId')
  getMessages(
    @Param('eventId') eventId: string,
    @Param('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 30;
    return this.chatService.getMessages(eventId, userId, pageNum, limitNum);
  }

  // Send a message
  @Post('event/:eventId/messages/user/:userId')
  sendMessage(
    @Param('eventId') eventId: string,
    @Param('userId') userId: string,
    @Body() body: { content: string; type?: string },
  ) {
    return this.chatService.sendMessage(
      eventId,
      userId,
      body.content,
      body.type || 'text',
    );
  }

  // Delete chat (admin only)
  @Delete('event/:eventId/user/:userId')
  deleteChat(
    @Param('eventId') eventId: string,
    @Param('userId') userId: string,
  ) {
    return this.chatService.deleteChat(eventId, userId);
  }
}
