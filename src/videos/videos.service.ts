import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from '../media/media.service';

@Injectable()
export class VideosService {
  constructor(
    private prisma: PrismaService,
    private mediaService: MediaService,
  ) {}

  /**
   * Crée un nouvel enregistrement vidéo en base
   */
  async create(data: {
    storagePath: string;
    userId: string;
    thumbnailPath?: string;
  }) {
    console.log('Creating video record:', data);

    return this.prisma.video.create({
      data,
      include: {
        user: {
          select: { id: true, username: true, photo: true },
        },
      },
    });
  }
}
