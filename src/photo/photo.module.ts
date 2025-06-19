import { Module } from '@nestjs/common';
import { PhotoController } from './photo.controller';
import { MediaModule } from '@/media/media.module';

@Module({
  imports: [MediaModule],
  controllers: [PhotoController],
})
export class PhotoModule {}
