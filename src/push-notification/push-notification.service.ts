import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreatePushTokenRequest, PushToken } from '@movapp/types';

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);

  constructor(private prisma: PrismaService) {}

  async createToken(data: CreatePushTokenRequest): Promise<PushToken> {
    try {
      // First, delete any existing token for this device (regardless of user)
      // This ensures one device = one user at any time
      await this.prisma.pushToken.deleteMany({
        where: { token: data.token },
      });

      // Create fresh token association for the current user
      const newToken = await this.prisma.pushToken.create({
        data: {
          token: data.token,
          userId: data.userId,
        },
      });

      this.logger.log(
        `[TOKEN_CREATED] Created push token for user ${data.userId}`,
      );
      return newToken as PushToken;
    } catch (error) {
      this.logger.error(
        `[TOKEN_CREATE_ERROR] Failed to create push token for user ${data.userId}`,
        error,
      );
      throw error;
    }
  }

  async removeToken(userId: string, token: string): Promise<boolean> {
    try {
      await this.prisma.pushToken.deleteMany({
        where: {
          userId,
          token,
        },
      });

      this.logger.log(`[TOKEN_REMOVED] Deleted push token for user ${userId}`);
      return true;
    } catch (error) {
      this.logger.error(
        `[TOKEN_REMOVE_ERROR] Failed to remove push token for user ${userId}`,
        error,
      );
      return false;
    }
  }

  async getEventParticipantsTokens(eventId: string): Promise<PushToken[]> {
    try {
      const tokens = await this.prisma.pushToken.findMany({
        where: {
          isActive: true,
          user: {
            eventParticipants: {
              some: {
                eventId,
                confirmed: true,
              },
            },
          },
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });

      return tokens as PushToken[];
    } catch (error) {
      this.logger.error(
        `[TOKEN_QUERY_ERROR] Failed to get push tokens for event ${eventId}`,
        error,
      );
      throw error;
    }
  }

  async getUserTokens(userId: string): Promise<PushToken[]> {
    try {
      const tokens = await this.prisma.pushToken.findMany({
        where: {
          userId,
          isActive: true,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });

      return tokens as PushToken[];
    } catch (error) {
      this.logger.error(
        `[TOKEN_QUERY_ERROR] Failed to get push tokens for user ${userId}`,
        error,
      );
      throw error;
    }
  }

  async cleanupExpiredTokens(): Promise<number> {
    try {
      // Désactiver les tokens qui n'ont pas été utilisés depuis 30 jours
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await this.prisma.pushToken.updateMany({
        where: {
          lastUsedAt: {
            lt: thirtyDaysAgo,
          },
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });

      return result.count;
    } catch (error) {
      this.logger.error(
        `[TOKEN_CLEANUP_ERROR] Failed to cleanup expired push tokens`,
        error,
      );
      throw error;
    }
  }
}
