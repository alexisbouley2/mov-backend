import { Injectable, Logger } from '@nestjs/common';
import { PushNotificationService } from './push-notification.service';
import { FirebaseAdminService } from './firebase-admin.service';

@Injectable()
export class FCMService {
  private readonly logger = new Logger(FCMService.name);

  constructor(
    private pushNotificationService: PushNotificationService,
    private firebaseAdminService: FirebaseAdminService,
  ) {}

  /**
   * Envoie une notification push pour un nouveau message à tous les participants d'un événement
   */
  async sendNewMessageNotification(data: {
    eventId: string;
    senderId: string;
    senderName: string;
    messageContent: string;
    eventName?: string;
  }): Promise<void> {
    try {
      // Récupérer tous les tokens des participants de l'événement (sauf l'expéditeur)
      const participantTokens =
        await this.pushNotificationService.getEventParticipantsTokens(
          data.eventId,
        );

      if (participantTokens.length === 0) {
        return;
      }

      // Filtrer pour exclure l'expéditeur du message
      // const recipientTokens = participantTokens.filter(
      //   (tokenData) => tokenData.userId !== data.senderId,
      // );
      const recipientTokens = participantTokens;
      //TODO: set filter back, this is used only for debugging purpose

      if (recipientTokens.length === 0) {
        return;
      }

      // Préparer le payload de notification
      const notification = {
        title: data.eventName || 'Nouveau message',
        body: `${data.senderName}: ${this.truncateMessage(data.messageContent)}`,
      };

      const payloadData = {
        type: 'new_message',
        eventId: data.eventId,
        senderId: data.senderId,
        messageContent: data.messageContent,
      };

      // Envoyer les notifications en parallèle
      const sendPromises = recipientTokens.map((tokenData) =>
        this.sendFCMNotification(tokenData.token, notification, payloadData),
      );

      await Promise.allSettled(sendPromises);
    } catch (error) {
      this.logger.error(
        `[NOTIFICATION_ERROR] Error sending push notifications for new message:`,
        error,
      );
    }
  }

  /**
   * Envoie une notification FCM à un token spécifique
   */
  private async sendFCMNotification(
    token: string,
    notification: { title: string; body: string },
    data: Record<string, string>,
  ): Promise<void> {
    try {
      // Appeler Firebase FCM via le service Firebase Admin
      await this.firebaseAdminService.sendToToken(token, notification, data);
    } catch (error) {
      this.logger.error(
        `Failed to send FCM notification to token ${token.substring(0, 20)}...:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Tronque le message pour la notification
   */
  private truncateMessage(message: string, maxLength: number = 100): string {
    if (message.length <= maxLength) {
      return message;
    }
    return message.substring(0, maxLength - 3) + '...';
  }
}
