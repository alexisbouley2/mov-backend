import { Controller, Get, Post, Delete, Body, Param } from '@nestjs/common';
import { PushNotificationService } from './push-notification.service';
import {
  CreatePushTokenRequest,
  PushToken,
  RemovePushTokenRequest,
} from '@movapp/types';

@Controller('push-tokens')
export class PushNotificationController {
  constructor(
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  @Post()
  async createToken(
    @Body() createTokenDto: CreatePushTokenRequest,
  ): Promise<PushToken> {
    return await this.pushNotificationService.createToken(createTokenDto);
  }

  @Delete()
  async removeToken(
    @Body() removeTokenDto: RemovePushTokenRequest,
  ): Promise<{ success: boolean }> {
    const success = await this.pushNotificationService.removeToken(
      removeTokenDto.userId,
      removeTokenDto.token,
    );
    return { success };
  }

  @Get('event/:eventId')
  async getEventParticipantsTokens(
    @Param('eventId') eventId: string,
  ): Promise<PushToken[]> {
    return await this.pushNotificationService.getEventParticipantsTokens(
      eventId,
    );
  }
}
