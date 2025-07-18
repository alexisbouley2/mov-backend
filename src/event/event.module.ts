import { Module } from '@nestjs/common';
import { EventService } from './event.service';
import { EventController } from './event.controller';
import { PrismaModule } from '@/prisma/prisma.module';
import { MediaModule } from '@/media/media.module';
import { VideoModule } from '@/video/video.module';
import { PushNotificationModule } from '@/push-notification/push-notification.module';

@Module({
  imports: [PrismaModule, MediaModule, VideoModule, PushNotificationModule],
  controllers: [EventController],
  providers: [EventService],
})
export class EventModule {}
