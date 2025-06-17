import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { PrismaModule } from '@/prisma/prisma.module';
import { MediaModule } from '@/media/media.module';

@Module({
  imports: [PrismaModule, MediaModule],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
