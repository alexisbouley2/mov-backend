// src/message/message.controller.ts
import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { MessageService } from './message.service';

@Controller('messages')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  // Get message preview for event detail page
  @Get('event/:eventId/preview/user/:userId')
  getMessagePreview(
    @Param('eventId') eventId: string,
    @Param('userId') userId: string,
  ) {
    return this.messageService.getMessagePreview(eventId, userId);
  }

  // Get messages with pagination for an event
  @Get('event/:eventId/user/:userId')
  getMessages(
    @Param('eventId') eventId: string,
    @Param('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 30;
    return this.messageService.getMessages(eventId, userId, pageNum, limitNum);
  }

  // Send a message to an event
  @Post('event/:eventId/user/:userId')
  sendMessage(
    @Param('eventId') eventId: string,
    @Param('userId') userId: string,
    @Body() body: { content: string; type?: string },
  ) {
    return this.messageService.sendMessage(
      eventId,
      userId,
      body.content,
      body.type || 'text',
    );
  }
}
