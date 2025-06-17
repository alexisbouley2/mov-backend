import { Injectable } from '@nestjs/common';
import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, BUCKET_NAME } from '../config/s3.config';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MediaService {
  // ===========================================
  // CORE METHODS (Generic for any file type)
  // ===========================================

  /**
   * Generate presigned URL for uploading any file type
   */
  async getPresignedUploadUrl(
    key: string,
    contentType: string,
    metadata?: Record<string, string>,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
      Metadata: {
        uploadedAt: new Date().toISOString(),
        ...metadata,
      },
    });

    return getSignedUrl(s3Client, command, {
      expiresIn: 3600, // 1 hour
    });
  }

  /**
   * Generate presigned URL for downloading/viewing any file
   */
  async getPresignedDownloadUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    return getSignedUrl(s3Client, command, {
      expiresIn: 3600, // 1 hour
    });
  }

  /**
   * Check if a file exists on R2
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });

      await s3Client.send(command);
      return true;
    } catch (error) {
      console.error('File existence check error:', error);
      return false;
    }
  }

  /**
   * Delete a file from R2
   */
  async deleteFromR2(key: string): Promise<void> {
    try {
      console.log(`Deleting file from R2: ${key}`);

      const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });

      await s3Client.send(command);

      console.log(`File deleted successfully: ${key}`);
    } catch (error) {
      console.error(`Error deleting file ${key}:`, error);
      throw error;
    }
  }

  /**
   * Delete multiple files from R2
   */
  async deleteMultipleFiles(keys: string[]): Promise<void> {
    try {
      await Promise.all(keys.map((key) => this.deleteFromR2(key)));
    } catch (error) {
      console.error('Error deleting multiple files:', error);
      throw error;
    }
  }

  // ===========================================
  // FILE NAME GENERATORS
  // ===========================================

  /**
   * Generate video file names
   */
  generateVideoFileNames(userId: string): {
    video: string;
    thumbnail: string;
  } {
    const timestamp = Date.now();
    const uuid = uuidv4();

    return {
      video: `videos/${userId}/${timestamp}_${uuid}.mp4`,
      thumbnail: `thumbnails/${userId}/${timestamp}_${uuid}.jpg`,
    };
  }

  /**
   * Generate photo file names
   */
  generatePhotoFileNames(
    userId: string,
    entityType: 'user' | 'event',
  ): {
    thumbnail: string;
    full: string;
  } {
    const timestamp = Date.now();
    const uuid = uuidv4();

    return {
      thumbnail: `${entityType}s/${userId}/photos/${timestamp}_${uuid}_thumbnail.jpg`,
      full: `${entityType}s/${userId}/photos/${timestamp}_${uuid}_full.jpg`,
    };
  }

  // ===========================================
  // VIDEO-SPECIFIC METHODS
  // ===========================================

  /**
   * Generate presigned URL for video upload
   */
  async generateUploadUrl(userId: string): Promise<{
    uploadUrl: string;
    fileName: string;
    expiresIn: number;
  }> {
    const { video: fileName } = this.generateVideoFileNames(userId);

    const uploadUrl = await this.getPresignedUploadUrl(fileName, 'video/mp4', {
      userId,
    });

    return {
      uploadUrl,
      fileName,
      expiresIn: 3600,
    };
  }

  /**
   * Generate presigned URL for thumbnail upload
   */
  async generateThumbnailUploadUrl(userId: string): Promise<{
    uploadUrl: string;
    fileName: string;
    expiresIn: number;
  }> {
    const { thumbnail: fileName } = this.generateVideoFileNames(userId);

    const uploadUrl = await this.getPresignedUploadUrl(fileName, 'image/jpeg', {
      userId,
    });

    return {
      uploadUrl,
      fileName,
      expiresIn: 3600,
    };
  }

  /**
   * Get both video and thumbnail URLs
   */
  async getVideoUrls(
    videoPath: string,
    thumbnailPath: string,
  ): Promise<{
    videoUrl: string;
    thumbnailUrl: string;
  }> {
    const [videoUrl, thumbnailUrl] = await Promise.all([
      this.getPresignedDownloadUrl(videoPath),
      this.getPresignedDownloadUrl(thumbnailPath),
    ]);

    return { videoUrl, thumbnailUrl };
  }

  /**
   * Delete both video and thumbnail files
   */
  async deleteVideoFiles(
    videoPath: string,
    thumbnailPath?: string,
  ): Promise<void> {
    const filesToDelete = [videoPath];
    if (thumbnailPath) {
      filesToDelete.push(thumbnailPath);
    }

    await this.deleteMultipleFiles(filesToDelete);
  }

  // ===========================================
  // PHOTO-SPECIFIC METHODS
  // ===========================================

  /**
   * Generate presigned URLs for photo upload (both thumbnail and full)
   */
  async generatePhotoUploadUrls(
    userId: string,
    entityType: 'user' | 'event',
  ): Promise<{
    thumbnail: { uploadUrl: string; fileName: string };
    full: { uploadUrl: string; fileName: string };
  }> {
    const fileNames = this.generatePhotoFileNames(userId, entityType);

    const [thumbnailUrl, fullUrl] = await Promise.all([
      this.getPresignedUploadUrl(fileNames.thumbnail, 'image/jpeg', { userId }),
      this.getPresignedUploadUrl(fileNames.full, 'image/jpeg', { userId }),
    ]);

    return {
      thumbnail: { uploadUrl: thumbnailUrl, fileName: fileNames.thumbnail },
      full: { uploadUrl: fullUrl, fileName: fileNames.full },
    };
  }

  /**
   * Get photo URLs for user
   */
  async getUserPhotoUrls(user: {
    photoStoragePath?: string;
    photoThumbnailPath?: string;
  }): Promise<{
    photoUrl?: string;
    photoThumbnailUrl?: string;
  }> {
    if (!user.photoStoragePath || !user.photoThumbnailPath) {
      return {};
    }

    const [photoUrl, photoThumbnailUrl] = await Promise.all([
      this.getPresignedDownloadUrl(user.photoStoragePath),
      this.getPresignedDownloadUrl(user.photoThumbnailPath),
    ]);

    return { photoUrl, photoThumbnailUrl };
  }

  /**
   * Get photo URLs for event
   */
  async getEventPhotoUrls(event: {
    photoStoragePath?: string;
    photoThumbnailPath?: string;
  }): Promise<{
    photoUrl?: string;
    photoThumbnailUrl?: string;
  }> {
    if (!event.photoStoragePath || !event.photoThumbnailPath) {
      return {};
    }

    const [photoUrl, photoThumbnailUrl] = await Promise.all([
      this.getPresignedDownloadUrl(event.photoStoragePath),
      this.getPresignedDownloadUrl(event.photoThumbnailPath),
    ]);

    return { photoUrl, photoThumbnailUrl };
  }

  /**
   * Delete photo files from R2
   */
  async deletePhotoFiles(
    fullPath: string,
    thumbnailPath: string,
  ): Promise<void> {
    await this.deleteMultipleFiles([fullPath, thumbnailPath]);
  }

  // ===========================================
  // LEGACY COMPATIBILITY METHODS
  // ===========================================

  /**
   * @deprecated Use deleteFromR2 instead
   */
  async deleteFile(fileName: string): Promise<void> {
    return this.deleteFromR2(fileName);
  }

  /**
   * @deprecated Use getPresignedDownloadUrl instead
   */
  async getSignedViewUrl(fileName: string): Promise<string> {
    return this.getPresignedDownloadUrl(fileName);
  }
}
