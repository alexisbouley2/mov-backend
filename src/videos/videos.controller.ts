import {
  Controller,
  Post,
  Body,
  BadRequestException,
  Delete,
  Param,
} from '@nestjs/common';
import { VideosService } from './videos.service';
import { MediaService } from '../media/media.service';

// DTOs pour validation
interface GetUploadUrlDto {
  userId: string;
  contentType: string; // "video/mp4"
}

interface ConfirmUploadDto {
  fileName: string;
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
      throw new BadRequestException('fileName and userId are required');
    }

    try {
      // Optionnel: Vérifier que le fichier existe sur R2
      const fileExists = await this.mediaService.fileExists(body.fileName);
      if (!fileExists) {
        throw new BadRequestException('File not found on cloud storage');
      }

      // Sauvegarder en base avec status "pending"
      const video = await this.videosService.create({
        storagePath: body.fileName,
        userId: body.userId,
        status: 'pending', // Will be updated when events are associated
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
      // Find the video by storagePath
      const video = await this.videosService.findByStoragePath(body.fileName);

      if (!video) {
        throw new BadRequestException('Video not found');
      }

      // Verify the video belongs to the user
      if (video.userId !== body.userId) {
        throw new BadRequestException('Unauthorized');
      }

      // Update video with events and set status to published
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
      // Verify the video exists and belongs to the user
      const video = await this.videosService.findById(body.videoId);

      if (!video) {
        throw new BadRequestException('Video not found');
      }

      if (video.userId !== body.userId) {
        throw new BadRequestException('Unauthorized');
      }

      // Remove from events
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
   */ @Post('delete')
  async deleteVideo(@Body() body: DeleteVideoDto) {
    console.log('Deleting video:', body);

    if (!body.fileName || !body.userId) {
      throw new BadRequestException('fileName and userId are required');
    }

    try {
      // Find video
      const video = await this.videosService.findByStoragePath(body.fileName);

      if (!video) {
        throw new BadRequestException('Video not found');
      }

      if (video.userId !== body.userId) {
        throw new BadRequestException('Unauthorized');
      }

      // Check if video has event associations
      if (video.events && video.events.length > 0) {
        throw new BadRequestException(
          'Cannot delete video that is associated with events. Remove from events first.',
        );
      }

      // Delete video (will also delete from R2)
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
      // Verify the video exists and belongs to the user
      const video = await this.videosService.findById(videoId);

      if (!video) {
        throw new BadRequestException('Video not found');
      }

      if (video.userId !== userId) {
        throw new BadRequestException('Unauthorized');
      }

      // Remove from single event
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
