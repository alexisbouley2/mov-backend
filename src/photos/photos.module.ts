import { Module } from '@nestjs/common';
import { PhotosController } from './photos.controller';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [MediaModule],
  controllers: [PhotosController],
})
export class PhotosModule {}
