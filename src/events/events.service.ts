import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    name: string;
    information?: string;
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
      information?: string;
      date?: Date;
      location?: string;
    },
  ) {
    return this.prisma.event.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.event.delete({ where: { id } });
  }

  async getUserEvents(userId: string) {
    const events = await this.prisma.event.findMany({
      where: {
        OR: [{ adminId: userId }, { participants: { some: { userId } } }],
      },
      include: {
        admin: true,
        participants: {
          include: { user: true },
        },
        _count: {
          select: { videos: true },
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    // Categorize events based on date + 24h window
    const now = new Date();

    const categorized = {
      past: events.filter((event) => {
        const eventDate = new Date(event.date);
        const eventEnd = new Date(eventDate.getTime() + 24 * 60 * 60 * 1000); // date + 24h
        return eventEnd < now; // date + 24h is already passed
      }),
      current: events.filter((event) => {
        const eventDate = new Date(event.date);
        const eventEnd = new Date(eventDate.getTime() + 24 * 60 * 60 * 1000); // date + 24h
        return eventDate <= now && now < eventEnd; // date <= now < date + 24h
      }),
      planned: events.filter((event) => {
        const eventDate = new Date(event.date);
        return now < eventDate; // now < date
      }),
    };

    return categorized;
  }
}
