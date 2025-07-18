import {
  Controller,
  Post,
  Body,
  Delete,
  HttpCode,
  HttpStatus,
  Get,
  Param,
  Patch,
} from '@nestjs/common';
import { PushNotificationService } from './push-notification.service';
import { CreatePushTokenRequest, PushToken } from '@movapp/types';

@Controller('push-notifications')
export class PushNotificationController {
  constructor(
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  @Post('tokens')
  @HttpCode(HttpStatus.CREATED)
  async createToken(@Body() data: CreatePushTokenRequest): Promise<PushToken> {
    return this.pushNotificationService.createToken(data);
  }

  @Delete('tokens')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeToken(
    @Body() data: { userId: string; token: string },
  ): Promise<void> {
    await this.pushNotificationService.removeToken(data.userId, data.token);
  }

  @Get('badges/:userId')
  async getBadgeCount(
    @Param('userId') userId: string,
  ): Promise<{ count: number }> {
    const count =
      await this.pushNotificationService.getUnreadNotificationCount(userId);
    return { count };
  }

  @Patch('badges/:userId/events/:eventId/read')
  @HttpCode(HttpStatus.OK)
  async markEventNotificationsAsRead(
    @Param('userId') userId: string,
    @Param('eventId') eventId: string,
  ): Promise<{ markedCount: number; newBadgeCount: number }> {
    const markedCount =
      await this.pushNotificationService.markEventNotificationsAsRead(
        userId,
        eventId,
      );
    const newBadgeCount =
      await this.pushNotificationService.getUnreadNotificationCount(userId);
    return { markedCount, newBadgeCount };
  }
}
