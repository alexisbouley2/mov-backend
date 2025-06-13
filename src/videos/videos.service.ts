import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VideosService {
  constructor(private prisma: PrismaService) {}

  async create(data: { storagePath: string; userId: string; eventId: string }) {
    return this.prisma.video.create({ data });
  }

  async findAll() {
    return this.prisma.video.findMany({
      include: { user: true, event: true },
    });
  }

  async findByEvent(eventId: string) {
    return this.prisma.video.findMany({
      where: { eventId },
      include: { user: true },
    });
  }

  async findOne(id: string) {
    return this.prisma.video.findUnique({
      where: { id },
      include: { user: true, event: true },
    });
  }

  async remove(id: string) {
    return this.prisma.video.delete({ where: { id } });
  }
}
