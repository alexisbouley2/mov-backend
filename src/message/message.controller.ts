// src/message/message.controller.ts
import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { MessageService } from './message.service';
import {
  SendMessageRequest,
  EventMessagesResponse,
  Message,
} from '@movapp/types';

@Controller('messages')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  // Get messages with pagination for an event
  @Get('event/:eventId/user/:userId')
  getMessages(
    @Param('eventId') eventId: string,
    @Param('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<EventMessagesResponse> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 30;
    return this.messageService.getMessages(eventId, userId, pageNum, limitNum);
  }

  // Send a message to an event
  @Post('event/:eventId/user/:userId')
  sendMessage(
    @Param('eventId') eventId: string,
    @Param('userId') userId: string,
    @Body() body: SendMessageRequest,
  ): Promise<Message> {
    return this.messageService.sendMessage(
      eventId,
      userId,
      body.content,
      body.type || 'text',
    );
  }

  // Get a single message by ID with sender information
  @Get(':messageId/user/:userId')
  getMessageById(
    @Param('messageId') messageId: string,
    @Param('userId') userId: string,
  ): Promise<Message | null> {
    return this.messageService.getMessageById(messageId, userId);
  }
}
