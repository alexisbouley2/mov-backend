import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { MediaService } from './media.service';
import { Logger } from '@nestjs/common';

interface UploadUrlResponse {
  uploadUrl: string;
  fileName: string;
  type: 'thumbnail' | 'image' | 'video';
}

@Controller('media')
export class MediaController {
  private readonly logger = new Logger(MediaController.name);

  constructor(private readonly mediaService: MediaService) {}

  @Get('upload-urls')
  async getUploadUrls(
    @Query('userId') userId: string,
    @Query('entityType') entityType: 'video' | 'user' | 'event',
  ): Promise<{ urls: UploadUrlResponse[] }> {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }

    if (!entityType) {
      throw new BadRequestException('entityType is required');
    }

    try {
      let urls: UploadUrlResponse[] = [];

      if (entityType === 'video') {
        // For videos, we need both video and thumbnail URLs
        const [videoUpload, thumbnailUpload] = await Promise.all([
          this.mediaService.generateUploadUrl(userId, 'full', 'video'),
          this.mediaService.generateUploadUrl(userId, 'thumbnail', 'video'),
        ]);

        urls = [
          {
            uploadUrl: videoUpload.uploadUrl,
            fileName: videoUpload.fileName,
            type: 'video',
          },
          {
            uploadUrl: thumbnailUpload.uploadUrl,
            fileName: thumbnailUpload.fileName,
            type: 'thumbnail',
          },
        ];
      } else {
        // For photos (user/event), we need thumbnail and image URLs
        const [thumbnailResult, imageResult] = await Promise.all([
          this.mediaService.generateUploadUrl(userId, 'thumbnail', entityType),
          this.mediaService.generateUploadUrl(userId, 'full', entityType),
        ]);

        urls = [
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
      }

      return { urls };
    } catch (error) {
      this.logger.error('Error generating upload URLs:', error);
      throw new BadRequestException('Failed to generate upload URLs');
    }
  }
}
