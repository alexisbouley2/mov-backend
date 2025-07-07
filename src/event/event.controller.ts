import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  Delete,
} from '@nestjs/common';
import { EventService } from './event.service';
import {
  CreateEventRequest,
  UpdateEventRequest,
  Event,
  UpdateEventResponse,
  EventParticipantsResponse,
  EventWithDetails,
  CategorizedEventsResponse,
  DeleteEventResponse,
  GenerateInviteRequest,
  GenerateInviteResponse,
  ValidateInviteRequest,
  ValidateInviteResponse,
} from '@movapp/types';

@Controller('events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Post()
  create(@Body() createEventDto: CreateEventRequest): Promise<Event> {
    return this.eventService.create(createEventDto);
  }

  @Get('user/:userId')
  getUserEvents(
    @Param('userId') userId: string,
  ): Promise<CategorizedEventsResponse> {
    return this.eventService.getUserEvents(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<EventWithDetails | null> {
    return this.eventService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventRequest,
  ): Promise<UpdateEventResponse> {
    return this.eventService.update(id, updateEventDto);
  }

  @Get(':id/participants/user/:userId')
  getEventParticipants(
    @Param('id') eventId: string,
    @Param('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<EventParticipantsResponse> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.eventService.getEventParticipants(
      eventId,
      userId,
      pageNum,
      limitNum,
    );
  }

  @Post(':id/invite')
  generateInvite(
    @Param('id') eventId: string,
    @Body() body: GenerateInviteRequest,
  ): Promise<GenerateInviteResponse> {
    return this.eventService.generateInvite(eventId, body.userId);
  }

  @Post('invite/validate')
  validateInvite(
    @Body() body: ValidateInviteRequest,
  ): Promise<ValidateInviteResponse> {
    return this.eventService.validateInvite(body.token);
  }

  @Post('invite/accept')
  acceptInvite(
    @Body() body: { token: string; userId: string },
  ): Promise<{ success: boolean; message: string }> {
    return this.eventService.acceptInvite(body.token, body.userId);
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @Query('userId') userId: string,
  ): Promise<DeleteEventResponse> {
    return this.eventService.delete(id, userId);
  }
}
