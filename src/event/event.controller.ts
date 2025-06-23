import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
} from '@nestjs/common';
import { EventService } from './event.service';

@Controller('events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Post()
  create(@Body() createEventDto: any) {
    return this.eventService.create(createEventDto);
  }

  @Get('user/:userId')
  getUserEvents(@Param('userId') userId: string) {
    return this.eventService.getUserEvents(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateEventDto: any) {
    return this.eventService.update(id, updateEventDto);
  }

  @Get(':id/participants/user/:userId')
  getEventParticipants(
    @Param('id') eventId: string,
    @Param('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.eventService.getEventParticipants(
      eventId,
      userId,
      pageNum,
      limitNum,
    );
  }
}
