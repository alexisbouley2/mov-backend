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
  /**
   * Generate presigned URL for video upload
   */
  async generateUploadUrl(userId: string): Promise<{
    uploadUrl: string;
    fileName: string;
    expiresIn: number;
  }> {
    const fileName = `videos/${userId}/${uuidv4()}.mp4`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileName,
      ContentType: 'video/mp4',
      Metadata: {
        userId,
        uploadedAt: new Date().toISOString(),
      },
    });

    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600, // 1 hour
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
    const fileName = `thumbnails/${userId}/${uuidv4()}.jpg`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileName,
      ContentType: 'image/jpeg',
      Metadata: {
        userId,
        uploadedAt: new Date().toISOString(),
      },
    });

    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600, // 1 hour
    });

    return {
      uploadUrl,
      fileName,
      expiresIn: 3600,
    };
  }

  /**
   * Check if a file exists on R2
   */
  async fileExists(fileName: string): Promise<boolean> {
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName,
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
  async deleteFile(fileName: string): Promise<void> {
    try {
      console.log(`Deleting file from R2: ${fileName}`);

      const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName,
      });

      await s3Client.send(command);

      console.log(`File deleted successfully: ${fileName}`);
    } catch (error) {
      console.error(`Error deleting file ${fileName}:`, error);
      throw error;
    }
  }

  /**
   * Delete both video and thumbnail files
   */
  async deleteVideoFiles(
    videoPath: string,
    thumbnailPath?: string,
  ): Promise<void> {
    try {
      // Delete video file
      await this.deleteFile(videoPath);

      // Delete thumbnail file if it exists
      if (thumbnailPath) {
        await this.deleteFile(thumbnailPath);
      }
    } catch (error) {
      console.error('Error deleting video files:', error);
      throw error;
    }
  }

  /**
   * Generate signed URL for viewing/downloading
   */
  async getSignedViewUrl(fileName: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileName,
    });

    return getSignedUrl(s3Client, command, {
      expiresIn: 3600, // 1 hour
    });
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
      this.getSignedViewUrl(videoPath),
      this.getSignedViewUrl(thumbnailPath),
    ]);

    return { videoUrl, thumbnailUrl };
  }
}
