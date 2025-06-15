import { Injectable } from '@nestjs/common';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, BUCKET_NAME } from '../config/s3.config';
import { v4 as uuidv4 } from 'uuid';
// import sharp from 'sharp'; // Default import instead of namespace import
// import ffmpeg from 'fluent-ffmpeg';
// import * as fs from 'fs';
// import * as path from 'path';
// import * as os from 'os';

@Injectable()
export class MediaService {
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
      expiresIn: 3600, // 1 heure
    });

    return {
      uploadUrl,
      fileName,
      expiresIn: 3600,
    };
  }

  /**
   * Vérifie qu'un fichier existe sur R2 (optionnel, pour validation)
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
      console.error(error);
      return false;
    }
  }
}
