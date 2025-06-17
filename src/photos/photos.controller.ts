import { Controller, Post, Body } from '@nestjs/common';
import { MediaService } from '@/media/media.service';

interface UploadUrlResponse {
  uploadUrl: string;
  fileName: string;
  type: 'thumbnail' | 'full';
}

@Controller('photos')
export class PhotosController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload-urls')
  async getUploadUrls(
    @Body()
    body: {
      userId: string;
      entityType: 'user' | 'event';
      count?: number;
    },
  ): Promise<{ urls: UploadUrlResponse[] }> {
    const { userId, entityType, count = 2 } = body;

    const timestamp = Date.now();
    const urls: UploadUrlResponse[] = []; // Properly typed array

    for (let i = 0; i < count; i++) {
      const suffix = i === 0 ? 'thumbnail' : 'full';
      const key = `${entityType}s/${userId}/photos/${timestamp}_${suffix}.jpg`;
      const uploadUrl = await this.mediaService.getPresignedUploadUrl(
        key,
        'image/jpeg',
      );

      urls.push({
        uploadUrl,
        fileName: key,
        type: suffix, // Type assertion for safety
      });
    }

    return { urls };
  }
}
