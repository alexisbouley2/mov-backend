import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { EventsService } from './events.service';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  create(@Body() createEventDto: any) {
    return this.eventsService.create(createEventDto);
  }

  @Get()
  findAll() {
    return this.eventsService.findAll();
  }

  @Get('user/:userId')
  getUserEvents(@Param('userId') userId: string) {
    return this.eventsService.getUserEvents(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateEventDto: any) {
    return this.eventsService.update(id, updateEventDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.eventsService.remove(id);
  }

  @Post(':eventId/participants/:userId')
  addParticipant(
    @Param('eventId') eventId: string,
    @Param('userId') userId: string,
  ) {
    return this.eventsService.addParticipant(eventId, userId);
  }

  @Delete(':eventId/participants/:userId')
  removeParticipant(
    @Param('eventId') eventId: string,
    @Param('userId') userId: string,
  ) {
    return this.eventsService.removeParticipant(eventId, userId);
  }
}
