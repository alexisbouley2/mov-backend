import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    name: string;
    description?: string;
    date: Date;
    location?: string;
    adminId: string;
  }) {
    return this.prisma.event.create({ data });
  }

  async findAll() {
    return this.prisma.event.findMany({
      include: {
        admin: true,
        participants: { include: { user: true } },
        videos: true,
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.event.findUnique({
      where: { id },
      include: {
        admin: true,
        participants: { include: { user: true } },
        videos: { include: { user: true } },
      },
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
      date?: Date;
      location?: string;
    },
  ) {
    return this.prisma.event.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.event.delete({ where: { id } });
  }
}
