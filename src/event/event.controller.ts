import { Controller, Get, Post, Body, Patch, Param } from '@nestjs/common';
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
}
