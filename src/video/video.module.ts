import { Module } from '@nestjs/common';
import { VideoController } from './video.controller';
import { VideoService } from './video.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { MediaModule } from '@/media/media.module';

@Module({
  imports: [PrismaModule, MediaModule],
  controllers: [VideoController],
  providers: [VideoService],
  exports: [VideoService],
})
export class VideoModule {}
