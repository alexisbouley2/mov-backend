import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { VideosService } from './videos.service';
import { MediaService } from '../media/media.service';

// DTOs pour validation
interface GetUploadUrlDto {
  userId: string;
  eventId: string;
  contentType: string; // "video/mp4"
}

interface ConfirmUploadDto {
  fileName: string;
  userId: string;
  eventId: string;
}

@Controller('videos')
export class VideosController {
  constructor(
    private readonly videosService: VideosService,
    private readonly mediaService: MediaService,
  ) {}

  /**
   * POST /videos/upload-url
   * Génère une presigned URL pour upload direct
   */
  @Post('upload-url')
  async getUploadUrl(@Body() body: GetUploadUrlDto) {
    console.log('Generating upload URL for:', body);

    if (!body.userId) {
      throw new BadRequestException('userId is required');
    }

    if (!body.contentType || body.contentType !== 'video/mp4') {
      throw new BadRequestException('contentType must be video/mp4');
    }

    try {
      const result = await this.mediaService.generateUploadUrl(body.userId);

      console.log('Generated upload URL for file:', result.fileName);

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      console.error('Error generating upload URL:', error);
      throw new BadRequestException('Failed to generate upload URL');
    }
  }

  /**
   * POST /videos/confirm-upload
   * Confirme l'upload et sauvegarde en base
   */
  @Post('confirm-upload')
  async confirmUpload(@Body() body: ConfirmUploadDto) {
    console.log('Confirming upload for:', body);

    if (!body.fileName || !body.userId) {
      throw new BadRequestException('fileName, userId are required');
    }

    try {
      // Optionnel: Vérifier que le fichier existe sur R2
      const fileExists = await this.mediaService.fileExists(body.fileName);
      if (!fileExists) {
        throw new BadRequestException('File not found on cloud storage');
      }

      // Sauvegarder en base
      const video = await this.videosService.create({
        storagePath: body.fileName,
        userId: body.userId,
        // thumbnailPath: null, // Pas de thumbnail pour l'instant
      });

      console.log('Video saved to database:', video.id);

      return {
        success: true,
        video,
        message: 'Video upload confirmed successfully',
      };
    } catch (error) {
      console.error('Error confirming upload:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Failed to confirm upload');
    }
  }
}
