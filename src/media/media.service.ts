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

@Injectable()
export class MediaService {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly logger = new Logger(MediaService.name);

  constructor(private configService: ConfigService<EnvConfig>) {
    this.s3Client = createS3Client(this.configService);
    this.bucketName = getBucketName(this.configService);
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
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return getSignedUrl(this.s3Client, command, {
      expiresIn: 3600,
    });
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
    entityType: 'video' | 'event' | 'user',
    size: 'thumbnail' | 'full',
  ): string {
    const timestamp = Date.now();
    const uuid = uuidv4();

    return `${entityType}s/${id}/${timestamp}_${uuid}_${size}.jpg`;
  }

  async generateUploadUrl(
    id: string,
    size: 'thumbnail' | 'full',
    entityType: 'video' | 'event' | 'user',
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
