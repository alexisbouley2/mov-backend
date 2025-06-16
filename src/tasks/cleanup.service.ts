import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { VideosService } from '../videos/videos.service';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(private readonly videosService: VideosService) {}

  /**
   * Run cleanup every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleOrphanedVideos() {
    this.logger.log('Starting orphaned videos cleanup...');

    try {
      const deletedCount = await this.videosService.cleanupOrphanedVideos();
      this.logger.log(`Cleaned up ${deletedCount} orphaned videos`);
    } catch (error) {
      this.logger.error('Failed to cleanup orphaned videos', error);
    }
  }
}
