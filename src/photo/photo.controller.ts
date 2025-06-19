import { Controller, Get, Query } from '@nestjs/common';
import { MediaService } from '@/media/media.service';

interface UploadUrlResponse {
  uploadUrl: string;
  fileName: string;
  type: 'thumbnail' | 'image';
}

@Controller('photos')
export class PhotoController {
  constructor(private readonly mediaService: MediaService) {}

  @Get('upload-urls')
  async getUploadUrls(
    @Query('userId') userId: string,
    @Query('entityType') entityType: 'user' | 'event',
  ): Promise<{ urls: UploadUrlResponse[] }> {
    const thumbnailResult = await this.mediaService.generateUploadUrl(
      userId,
      'thumbnail',
      entityType,
    );
    const imageResult = await this.mediaService.generateUploadUrl(
      userId,
      'full',
      entityType,
    );

    const urls: UploadUrlResponse[] = [
      {
        uploadUrl: thumbnailResult.uploadUrl,
        fileName: thumbnailResult.fileName,
        type: 'thumbnail',
      },
      {
        uploadUrl: imageResult.uploadUrl,
        fileName: imageResult.fileName,
        type: 'image',
      },
    ];

    return { urls };
  }
}
