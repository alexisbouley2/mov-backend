import {
  Controller,
  Get,
  Query,
  BadRequestException,
  Post,
  Body,
} from '@nestjs/common';
import { MediaService } from './media.service';
import { Logger } from '@nestjs/common';
import {
  GetUploadUrlsResponse,
  MediaEntityType,
  UploadUrlResponse,
  DeleteMediaResponse,
  DeleteMediaRequest,
} from '@movapp/types';

@Controller('media')
export class MediaController {
  private readonly logger = new Logger(MediaController.name);

  constructor(private readonly mediaService: MediaService) {}

  @Get('upload-urls')
  async getUploadUrls(
    @Query('userId') userId: string,
    @Query('entityType') entityType: MediaEntityType,
  ): Promise<GetUploadUrlsResponse> {
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
            type: 'video' as const,
          },
          {
            uploadUrl: thumbnailUpload.uploadUrl,
            fileName: thumbnailUpload.fileName,
            type: 'thumbnail' as const,
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
            type: 'thumbnail' as const,
          },
          {
            uploadUrl: imageResult.uploadUrl,
            fileName: imageResult.fileName,
            type: 'image' as const,
          },
        ];
      }

      return { urls };
    } catch (error) {
      this.logger.error('Error generating upload URLs:', error);
      throw new BadRequestException('Failed to generate upload URLs');
    }
  }

  @Post('delete')
  async deleteMedia(
    @Body() body: DeleteMediaRequest,
  ): Promise<DeleteMediaResponse> {
    if (!body.fileNames || body.fileNames.length === 0) {
      throw new BadRequestException(
        'fileNames array is required and cannot be empty',
      );
    }

    if (!body.userId) {
      throw new BadRequestException('userId is required');
    }

    try {
      await this.mediaService.deleteMultipleFiles(body.fileNames);

      return {
        success: true,
        message: 'Media files deleted successfully',
      };
    } catch (error) {
      this.logger.error('Error deleting media files:', error);
      throw new BadRequestException('Failed to delete media files');
    }
  }
}
