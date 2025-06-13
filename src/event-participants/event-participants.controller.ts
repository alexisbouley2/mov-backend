import { Controller, Get, Post, Body, Delete, Param } from '@nestjs/common';
import { EventParticipantsService } from './event-participants.service';

@Controller('event-participants')
export class EventParticipantsController {
  constructor(
    private readonly eventParticipantsService: EventParticipantsService,
  ) {}

  @Post('join')
  joinEvent(@Body() joinEventDto: { userId: string; eventId: string }) {
    return this.eventParticipantsService.joinEvent(
      joinEventDto.userId,
      joinEventDto.eventId,
    );
  }

  @Delete('leave')
  leaveEvent(@Body() leaveEventDto: { userId: string; eventId: string }) {
    return this.eventParticipantsService.leaveEvent(
      leaveEventDto.userId,
      leaveEventDto.eventId,
    );
  }

  @Get('event/:eventId')
  getEventParticipants(@Param('eventId') eventId: string) {
    return this.eventParticipantsService.getEventParticipants(eventId);
  }
}
