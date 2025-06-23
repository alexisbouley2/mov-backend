import {
  Controller,
  Post,
  Body,
  BadRequestException,
  Param,
  Get,
  Query,
} from '@nestjs/common';
import { VideoService } from './video.service';
import { MediaService } from '@/media/media.service';
import { Logger } from '@nestjs/common';

interface VideoWithUrls {
  id: string;
  videoPath: string;
  thumbnailPath: string;
  videoUrl: string;
  thumbnailUrl: string;
  createdAt: Date;
  user: {
    id: string;
    username: string;
    profileThumbnailPath: string | null;
  };
}

interface VideoFeedResult {
  videos: VideoWithUrls[];
  nextCursor: string | null;
  hasMore: boolean;
}

interface AssociateEventsDto {
  fileName: string;
  userId: string;
  eventIds: string[];
}

interface DeleteVideoDto {
  fileName: string;
  userId: string;
}

interface ConfirmUploadDto {
  videoPath: string;
  thumbnailPath: string;
  userId: string;
}

@Controller('videos')
export class VideoController {
  private readonly logger = new Logger(VideoController.name);

  constructor(
    private readonly videoService: VideoService,
    private readonly mediaService: MediaService,
  ) {}

  /**
   * GET /videos/feed/:eventId
   * Get paginated video feed for an event
   */
  @Get('feed/:eventId')
  async getEventVideoFeed(
    @Param('eventId') eventId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limitParam?: string,
    @Query('userId') userId?: string, // Optional: filter by specific user
  ): Promise<{ success: boolean } & VideoFeedResult> {
    const limit = limitParam ? parseInt(limitParam, 10) : 20;

    if (limit > 50) {
      throw new BadRequestException('Limit cannot exceed 50');
    }

    try {
      const result = await this.videoService.getEventVideoFeed(eventId, {
        cursor,
        limit,
        userId,
      });

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      this.logger.error('Error fetching video feed:', error);
      throw new BadRequestException('Failed to fetch video feed');
    }
  }

  /**
   * POST /videos/confirm-upload
   * Confirm upload and save to database with thumbnail
   */
  @Post('confirm-upload')
  async confirmUpload(@Body() body: ConfirmUploadDto) {
    if (!body.videoPath || !body.thumbnailPath || !body.userId) {
      throw new BadRequestException(
        'videoPath, thumbnailPath and userId are required',
      );
    }

    try {
      // Check if both files exist on R2
      const [videoExists, thumbnailExists] = await Promise.all([
        this.mediaService.fileExists(body.videoPath),
        this.mediaService.fileExists(body.thumbnailPath),
      ]);

      if (!videoExists) {
        throw new BadRequestException('Video file not found on cloud storage');
      }

      if (!thumbnailExists) {
        throw new BadRequestException(
          'Thumbnail file not found on cloud storage',
        );
      }

      // Save to database with status "pending"
      const video = await this.videoService.create({
        videoPath: body.videoPath,
        thumbnailPath: body.thumbnailPath,
        userId: body.userId,
        status: 'pending',
      });

      return {
        success: true,
        video,
        message: 'Video upload confirmed successfully',
      };
    } catch (error) {
      this.logger.error('Error confirming upload:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Failed to confirm upload');
    }
  }

  /**
   * POST /videos/associate-events
   * Associate video with events and mark as published
   */
  @Post('associate-events')
  async associateEvents(@Body() body: AssociateEventsDto) {
    if (!body.fileName || !body.userId || !body.eventIds) {
      throw new BadRequestException(
        'fileName, userId, and eventIds are required',
      );
    }

    try {
      this.logger.debug('Associating events:', body);
      const video = await this.videoService.findByStoragePath(body.fileName);

      if (!video) {
        throw new BadRequestException('Video not found');
      }

      if (video.userId !== body.userId) {
        throw new BadRequestException('Unauthorized');
      }

      const updatedVideo = await this.videoService.associateWithEvents(
        video.id,
        body.eventIds,
      );

      return {
        success: true,
        video: updatedVideo,
        message: 'Video associated with events successfully',
      };
    } catch (error) {
      this.logger.error('Error associating events:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Failed to associate events');
    }
  }

  /**
   * POST /videos/delete
   * Delete video from R2 and database (only if no event associations)
   */
  @Post('delete')
  async deleteVideo(@Body() body: DeleteVideoDto) {
    if (!body.fileName || !body.userId) {
      throw new BadRequestException('fileName and userId are required');
    }

    try {
      const video = await this.videoService.findByStoragePath(body.fileName);

      if (!video) {
        throw new BadRequestException('Video not found');
      }

      if (video.userId !== body.userId) {
        throw new BadRequestException('Unauthorized');
      }

      if (video.events && video.events.length > 0) {
        throw new BadRequestException(
          'Cannot delete video that is associated with events. Remove from events first.',
        );
      }

      await this.videoService.delete(video.id);

      return {
        success: true,
        message: 'Video deleted successfully',
      };
    } catch (error) {
      this.logger.error('Error deleting video:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Failed to delete video');
    }
  }
}
