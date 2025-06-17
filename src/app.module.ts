import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma/prisma.service';
import { UsersModule } from './users/users.module';
import { EventsModule } from './events/events.module';
import { VideosModule } from './videos/videos.module';
import { EventParticipantsModule } from './event-participants/event-participants.module';
import { Module, MiddlewareConsumer } from '@nestjs/common';
import { LoggerMiddleware } from './middleware/logger.middleware';
import { MediaModule } from './media/media.module';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { CleanupService } from './tasks/cleanup.service';
import { ChatModule } from './chat/chat.module';
import { PhotosModule } from './photos/photos.module';
import { SupabaseModule } from './supabase/supabase.module';
import configuration from './config/configuration';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env.local', '.env', `.env.development`, '.env.staging'],
    }),
    ConfigModule.forRoot({ isGlobal: true }),
    UsersModule,
    EventsModule,
    VideosModule,
    MediaModule,
    PhotosModule,
    ChatModule,
    EventParticipantsModule,
    SupabaseModule,
  ],
  controllers: [AppController],
  providers: [PrismaService, AppService, CleanupService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
