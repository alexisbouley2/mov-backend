import { Module } from '@nestjs/common';
import { EventService } from './event.service';
import { EventController } from './event.controller';
import { PrismaModule } from '@/prisma/prisma.module';
import { MediaModule } from '@/media/media.module';

@Module({
  imports: [PrismaModule, MediaModule],
  controllers: [EventController],
  providers: [EventService],
})
export class EventModule {}
