import { S3Client } from '@aws-sdk/client-s3';

import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from './validation.schema';

export const createS3Client = (
  configService: ConfigService<EnvConfig>,
): S3Client => {
  return new S3Client({
    region: 'auto',
    endpoint: configService.get('CLOUDFLARE_R2_ENDPOINT', {
      infer: true,
    })!,
    credentials: {
      accessKeyId: configService.get('CLOUDFLARE_R2_ACCESS_KEY_ID', {
        infer: true,
      })!,
      secretAccessKey: configService.get('CLOUDFLARE_R2_SECRET_ACCESS_KEY', {
        infer: true,
      })!,
    },
  });
};

export const getBucketName = (
  configService: ConfigService<EnvConfig>,
): string => {
  return configService.get('CLOUDFLARE_R2_BUCKET_NAME', {
    infer: true,
  })!;
};

//never used
export const getPublicUrl = (
  configService: ConfigService<EnvConfig>,
): string => {
  return configService.get('CLOUDFLARE_R2_PUBLIC_URL', { infer: true })!;
};
