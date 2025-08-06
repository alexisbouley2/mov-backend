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
      const recipientTokens = participantTokens.filter(
        (tokenData) => tokenData.userId !== data.senderId,
      );

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

      // Grouper les tokens par userId
      const tokensByUser = recipientTokens.reduce(
        (acc, tokenData) => {
          if (!acc[tokenData.userId]) {
            acc[tokenData.userId] = [];
          }
          acc[tokenData.userId].push(tokenData);
          return acc;
        },
        {} as Record<string, typeof recipientTokens>,
      );

      // Créer les enregistrements de notification et envoyer les notifications en parallèle
      const sendPromises = Object.entries(tokensByUser).map(
        async ([userId, userTokens]) => {
          // Créer l'enregistrement de notification pour le badge (une seule fois par user)
          await this.pushNotificationService.createNotification({
            userId,
            eventId: data.eventId,
            type: 'new_message',
          });

          // Obtenir le nombre total de notifications non lues pour ce user (une seule fois par user)
          const badgeCount =
            await this.pushNotificationService.getUnreadNotificationCount(
              userId,
            );

          // Envoyer la notification pour chaque token de cet utilisateur
          const userSendPromises = userTokens.map((tokenData) =>
            this.sendFCMNotification(
              tokenData.token,
              notification,
              payloadData,
              badgeCount,
            ),
          );

          return Promise.allSettled(userSendPromises);
        },
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
   * Envoie une notification push quand un participant est ajouté à un événement
   */
  async sendParticipantAddedNotification(data: {
    eventId: string;
    addedUserId: string;
    addedUserName: string;
    adderUserId: string;
    adderUserName: string;
    eventName?: string;
  }): Promise<void> {
    try {
      // Récupérer les tokens push de l'utilisateur ajouté uniquement
      const addedUserTokens = await this.pushNotificationService.getUserTokens(
        data.addedUserId,
      );

      if (addedUserTokens.length === 0) {
        this.logger.debug(
          `No active push tokens found for user ${data.addedUserId}`,
        );
        return;
      }

      // Préparer le payload de notification
      const notification = {
        title: 'Event Invitation',
        body: `${data.adderUserName} invited you to join ${data.eventName || 'an event'}. Join the fun and give your MOV!`,
      };

      const payloadData = {
        type: 'participant_added',
        eventId: data.eventId,
        addedUserId: data.addedUserId,
        adderUserId: data.adderUserId,
      };

      // Créer l'enregistrement de notification et envoyer les notifications en parallèle
      const sendPromises = addedUserTokens.map(async (tokenData) => {
        // Créer l'enregistrement de notification pour le badge
        await this.pushNotificationService.createNotification({
          userId: data.addedUserId,
          eventId: data.eventId,
          type: 'participant_added',
        });

        // Obtenir le nombre total de notifications non lues pour ce user
        const badgeCount =
          await this.pushNotificationService.getUnreadNotificationCount(
            data.addedUserId,
          );

        // Envoyer la notification avec le bon badge count
        return this.sendFCMNotification(
          tokenData.token,
          notification,
          payloadData,
          badgeCount,
        );
      });

      await Promise.allSettled(sendPromises);
    } catch (error) {
      this.logger.error(
        `[NOTIFICATION_ERROR] Error sending push notifications for participant added:`,
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
    badgeCount: number,
  ): Promise<void> {
    try {
      // Appeler Firebase FCM via le service Firebase Admin
      await this.firebaseAdminService.sendToToken(
        token,
        notification,
        data,
        badgeCount,
      );
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
