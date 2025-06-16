import {
  Controller,
  Post,
  Body,
  BadRequestException,
  Delete,
  Param,
  Get,
  Query,
} from '@nestjs/common';
import { VideosService } from './videos.service';
import { MediaService } from '../media/media.service';

// Add interface at the top of the file after imports
interface VideoWithUrls {
  id: string;
  storagePath: string;
  thumbnailPath: string;
  videoUrl: string;
  thumbnailUrl: string;
  createdAt: Date;
  user: {
    id: string;
    username: string;
    photo: string | null;
  };
}

interface VideoFeedResult {
  videos: VideoWithUrls[];
  nextCursor: string | null;
  hasMore: boolean;
}

// DTOs for validation
interface GetUploadUrlDto {
  userId: string;
  contentType: string; // "video/mp4"
}

interface GetThumbnailUrlDto {
  userId: string;
  contentType: string; // "image/jpeg"
}

interface ConfirmUploadDto {
  fileName: string;
  thumbnailFileName: string;
  userId: string;
}

interface AssociateEventsDto {
  fileName: string;
  userId: string;
  eventIds: string[];
}

interface RemoveFromEventsDto {
  videoId: string;
  userId: string;
  eventIds: string[];
}

interface DeleteVideoDto {
  fileName: string;
  userId: string;
}

@Controller('videos')
export class VideosController {
  constructor(
    private readonly videosService: VideosService,
    private readonly mediaService: MediaService,
  ) {}

  /**
   * POST /videos/upload-url
   * Generate presigned URL for video upload
   */
  @Post('upload-url')
  async getUploadUrl(@Body() body: GetUploadUrlDto) {
    console.log('Generating video upload URL for:', body);

    if (!body.userId) {
      throw new BadRequestException('userId is required');
    }

    if (!body.contentType || body.contentType !== 'video/mp4') {
      throw new BadRequestException('contentType must be video/mp4');
    }

    try {
      const result = await this.mediaService.generateUploadUrl(body.userId);

      console.log('Generated video upload URL for file:', result.fileName);

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      console.error('Error generating video upload URL:', error);
      throw new BadRequestException('Failed to generate video upload URL');
    }
  }

  /**
   * POST /videos/thumbnail-url
   * Generate presigned URL for thumbnail upload
   */
  @Post('thumbnail-url')
  async getThumbnailUploadUrl(@Body() body: GetThumbnailUrlDto) {
    console.log('Generating thumbnail upload URL for:', body);

    if (!body.userId) {
      throw new BadRequestException('userId is required');
    }

    if (!body.contentType || body.contentType !== 'image/jpeg') {
      throw new BadRequestException('contentType must be image/jpeg');
    }

    try {
      const result = await this.mediaService.generateThumbnailUploadUrl(
        body.userId,
      );

      console.log('Generated thumbnail upload URL for file:', result.fileName);

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      console.error('Error generating thumbnail upload URL:', error);
      throw new BadRequestException('Failed to generate thumbnail upload URL');
    }
  }

  /**
   * POST /videos/confirm-upload
   * Confirm upload and save to database with thumbnail
   */
  @Post('confirm-upload')
  async confirmUpload(@Body() body: ConfirmUploadDto) {
    console.log('Confirming upload for:', body);

    if (!body.fileName || !body.thumbnailFileName || !body.userId) {
      throw new BadRequestException(
        'fileName, thumbnailFileName and userId are required',
      );
    }

    try {
      // Check if both files exist on R2
      const [videoExists, thumbnailExists] = await Promise.all([
        this.mediaService.fileExists(body.fileName),
        this.mediaService.fileExists(body.thumbnailFileName),
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
      const video = await this.videosService.create({
        storagePath: body.fileName,
        thumbnailPath: body.thumbnailFileName,
        userId: body.userId,
        status: 'pending',
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
      const result = await this.videosService.getEventVideoFeed(eventId, {
        cursor,
        limit,
        userId,
      });

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      console.error('Error fetching video feed:', error);
      throw new BadRequestException('Failed to fetch video feed');
    }
  }

  /**
   * POST /videos/associate-events
   * Associate video with events and mark as published
   */
  @Post('associate-events')
  async associateEvents(@Body() body: AssociateEventsDto) {
    console.log('Associating events for video:', body);

    if (!body.fileName || !body.userId || !body.eventIds) {
      throw new BadRequestException(
        'fileName, userId, and eventIds are required',
      );
    }

    try {
      const video = await this.videosService.findByStoragePath(body.fileName);

      if (!video) {
        throw new BadRequestException('Video not found');
      }

      if (video.userId !== body.userId) {
        throw new BadRequestException('Unauthorized');
      }

      const updatedVideo = await this.videosService.associateWithEvents(
        video.id,
        body.eventIds,
      );

      return {
        success: true,
        video: updatedVideo,
        message: 'Video associated with events successfully',
      };
    } catch (error) {
      console.error('Error associating events:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Failed to associate events');
    }
  }

  /**
   * POST /videos/remove-from-events
   * Remove video from specific events
   */
  @Post('remove-from-events')
  async removeFromEvents(@Body() body: RemoveFromEventsDto) {
    console.log('Removing video from events:', body);

    if (!body.videoId || !body.userId || !body.eventIds) {
      throw new BadRequestException(
        'videoId, userId, and eventIds are required',
      );
    }

    try {
      const video = await this.videosService.findById(body.videoId);

      if (!video) {
        throw new BadRequestException('Video not found');
      }

      if (video.userId !== body.userId) {
        throw new BadRequestException('Unauthorized');
      }

      const result = await this.videosService.removeFromEvents(
        body.videoId,
        body.eventIds,
      );

      if (result.deleted) {
        return {
          success: true,
          deleted: true,
          message: 'Video removed from all events and deleted',
        };
      }

      return {
        success: true,
        deleted: false,
        video: result.video,
        message: 'Video removed from specified events',
      };
    } catch (error) {
      console.error('Error removing video from events:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Failed to remove video from events');
    }
  }

  /**
   * POST /videos/delete
   * Delete video from R2 and database (only if no event associations)
   */
  @Post('delete')
  async deleteVideo(@Body() body: DeleteVideoDto) {
    console.log('Deleting video:', body);

    if (!body.fileName || !body.userId) {
      throw new BadRequestException('fileName and userId are required');
    }

    try {
      const video = await this.videosService.findByStoragePath(body.fileName);

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

      await this.videosService.delete(video.id);

      return {
        success: true,
        message: 'Video deleted successfully',
      };
    } catch (error) {
      console.error('Error deleting video:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Failed to delete video');
    }
  }

  /**
   * DELETE /videos/:videoId/events/:eventId
   * Remove a video from a specific event
   */
  @Delete(':videoId/events/:eventId')
  async removeFromEvent(
    @Param('videoId') videoId: string,
    @Param('eventId') eventId: string,
    @Body('userId') userId: string,
  ) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }

    try {
      const video = await this.videosService.findById(videoId);

      if (!video) {
        throw new BadRequestException('Video not found');
      }

      if (video.userId !== userId) {
        throw new BadRequestException('Unauthorized');
      }

      const result = await this.videosService.removeFromEvents(videoId, [
        eventId,
      ]);

      if (result.deleted) {
        return {
          success: true,
          deleted: true,
          message:
            'Video removed from event and deleted (no more associations)',
        };
      }

      return {
        success: true,
        deleted: false,
        message: 'Video removed from event',
        remainingEvents: result.video?.events.length || 0,
      };
    } catch (error) {
      console.error('Error removing video from event:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Failed to remove video from event');
    }
  }

  /**
   * POST /videos/cleanup-orphaned
   * Clean up orphaned videos (older than 10 minutes with pending status)
   */
  @Post('cleanup-orphaned')
  async cleanupOrphaned() {
    try {
      const deletedCount = await this.videosService.cleanupOrphanedVideos();

      return {
        success: true,
        deletedCount,
        message: `Cleaned up ${deletedCount} orphaned videos`,
      };
    } catch (error) {
      console.error('Error cleaning up orphaned videos:', error);
      throw new BadRequestException('Failed to cleanup orphaned videos');
    }
  }
}
