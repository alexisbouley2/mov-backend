import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '@nestjs/config';
import { createS3Client, getBucketName } from '@/config/s3.config';
import type { EnvConfig } from '@/config/validation.schema';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '@nestjs/common';
import { MediaEntityType, MediaSize } from '@movapp/types';

@Injectable()
export class MediaService {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly logger = new Logger(MediaService.name);

  // In-memory cache for presigned download URLs
  private readonly downloadUrlCache: Map<
    string,
    { url: string; expiresAt: number }
  > = new Map();
  private readonly cacheTTL = 55 * 60 * 1000; // 55 minutes in ms (presigned URL is 1h)

  constructor(private configService: ConfigService<EnvConfig>) {
    this.s3Client = createS3Client(this.configService);
    this.bucketName = getBucketName(this.configService);
  }

  /**
   * Clean up expired cache entries. Call this periodically from a cron job.
   */
  cleanupExpiredCacheEntries() {
    const now = Date.now();
    for (const [key, value] of this.downloadUrlCache.entries()) {
      if (value.expiresAt <= now) {
        this.downloadUrlCache.delete(key);
      }
    }
  }

  async getPresignedUploadUrl(
    key: string,
    contentType: string,
    metadata?: Record<string, string>,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
      Metadata: {
        uploadedAt: new Date().toISOString(),
        ...metadata,
      },
    });

    return getSignedUrl(this.s3Client, command, {
      expiresIn: 3600,
    });
  }

  async getPresignedDownloadUrl(key: string): Promise<string> {
    // Check cache first
    const cached = this.downloadUrlCache.get(key);
    const now = Date.now();
    if (cached) {
      if (cached.expiresAt > now) {
        return cached.url;
      } else {
        // Lazy cleanup: remove expired entry
        this.downloadUrlCache.delete(key);
      }
    }

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const url = await getSignedUrl(this.s3Client, command, {
      expiresIn: 3600,
    });
    // Cache the URL with TTL
    this.downloadUrlCache.set(key, {
      url,
      expiresAt: now + this.cacheTTL,
    });
    return url;
  }

  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      this.logger.error('File existence check error:', error);
      return false;
    }
  }

  async deleteFromR2(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      // Invalidate cache for this key
      this.downloadUrlCache.delete(key);
    } catch (error) {
      this.logger.error(`Error deleting file ${key}:`, error);
      throw error;
    }
  }

  async deleteMultipleFiles(keys: string[]): Promise<void> {
    try {
      await Promise.all(keys.map((key) => this.deleteFromR2(key)));
    } catch (error) {
      this.logger.error('Error deleting multiple files:', error);
      throw error;
    }
  }

  generateFileName(
    id: string,
    entityType: MediaEntityType,
    size: MediaSize,
  ): string {
    const timestamp = Date.now();
    const uuid = uuidv4();

    return `${entityType}s/${id}/${timestamp}_${uuid}_${size}.jpg`;
  }

  async generateUploadUrl(
    id: string,
    size: MediaSize,
    entityType: MediaEntityType,
  ): Promise<{
    uploadUrl: string;
    fileName: string;
    expiresIn: number;
  }> {
    const filename = this.generateFileName(id, entityType, size);
    let uploadUrl: string;
    switch (entityType) {
      case 'video':
        uploadUrl = await this.getPresignedUploadUrl(filename, 'video/mp4');
        break;
      case 'event':
        uploadUrl = await this.getPresignedUploadUrl(filename, 'image/jpeg');
        break;
      case 'user':
        uploadUrl = await this.getPresignedUploadUrl(filename, 'image/jpeg');
        break;
    }

    return {
      uploadUrl,
      fileName: filename,
      expiresIn: 3600,
    };
  }
}
