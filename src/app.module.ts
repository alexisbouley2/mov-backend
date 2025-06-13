import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma/prisma.service';
import { UsersModule } from './users/users.module';
import { EventsModule } from './events/events.module';
import { VideosModule } from './videos/videos.module';
import { EventParticipantsModule } from './event-participants/event-participants.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    UsersModule,
    EventsModule,
    VideosModule,
    EventParticipantsModule,
  ],
  providers: [PrismaService],
})
export class AppModule {}
