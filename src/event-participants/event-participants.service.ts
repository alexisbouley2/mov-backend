import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EventParticipantsService {
  constructor(private prisma: PrismaService) {}

  async joinEvent(userId: string, eventId: string) {
    return this.prisma.eventParticipant.create({
      data: { userId, eventId },
    });
  }

  async leaveEvent(userId: string, eventId: string) {
    return this.prisma.eventParticipant.delete({
      where: { userId_eventId: { userId, eventId } },
    });
  }

  async getEventParticipants(eventId: string) {
    return this.prisma.eventParticipant.findMany({
      where: { eventId },
      include: { user: true },
    });
  }
}
