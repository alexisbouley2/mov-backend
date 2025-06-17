import { Module } from '@nestjs/common';
import { EventParticipantsService } from './event-participants.service';
import { EventParticipantsController } from './event-participants.controller';
import { PrismaService } from '@/prisma/prisma.service';

@Module({
  controllers: [EventParticipantsController],
  providers: [EventParticipantsService, PrismaService],
})
export class EventParticipantsModule {}
