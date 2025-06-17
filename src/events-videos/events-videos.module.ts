import { Module } from '@nestjs/common';
import { EventsVideosService } from './events-videos.service';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [EventsVideosService],
  exports: [EventsVideosService],
})
export class EventsVideosModule {}
