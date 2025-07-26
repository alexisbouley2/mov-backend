import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { VideoService } from '@/video/video.service';
import { PushNotificationService } from '@/push-notification/push-notification.service';
import { MediaService } from '@/media/media.service';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(
    private readonly videoService: VideoService,
    private readonly pushNotificationService: PushNotificationService,
    private readonly mediaService: MediaService,
  ) {}

  /**
   * Run cleanup every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleOrphanedVideos() {
    this.logger.log('Starting orphaned videos cleanup...');

    try {
      const deletedCount = await this.videoService.cleanupOrphanedVideos();
      this.logger.log(`Cleaned up ${deletedCount} orphaned videos`);
    } catch (error) {
      this.logger.error('Failed to cleanup orphaned videos', error);
    }
  }

  /**
   * Run push token cleanup every day at 2 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleExpiredPushTokens() {
    this.logger.log('Starting expired push tokens cleanup...');

    try {
      const cleanedCount =
        await this.pushNotificationService.cleanupExpiredTokens();
      this.logger.log(`Cleaned up ${cleanedCount} expired push tokens`);
    } catch (error) {
      this.logger.error('Failed to cleanup expired push tokens', error);
    }
  }

  /**
   * Run media cache cleanup every 10 minutes
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  handleMediaCacheCleanup() {
    this.logger.log('Starting media cache cleanup...');
    this.mediaService.cleanupExpiredCacheEntries();
    this.logger.log('Media cache cleanup completed');
  }
}
