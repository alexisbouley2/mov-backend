import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import type { EnvConfig } from '@/config/validation.schema';

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseAdminService.name);
  private app: admin.app.App;

  constructor(private configService: ConfigService<EnvConfig>) {}

  onModuleInit() {
    this.initializeFirebase();
  }

  private initializeFirebase() {
    try {
      // Vérifier si Firebase est déjà initialisé
      if (admin.apps.length > 0) {
        this.app = admin.apps[0] as admin.app.App;
        return;
      }

      const projectId = this.configService.get('FIREBASE_PROJECT_ID', {
        infer: true,
      });
      const privateKey = this.configService.get('FIREBASE_PRIVATE_KEY', {
        infer: true,
      });
      const clientEmail = this.configService.get('FIREBASE_CLIENT_EMAIL', {
        infer: true,
      });

      if (!projectId || !privateKey || !clientEmail) {
        const missingKeys: string[] = [];
        if (!projectId) missingKeys.push('FIREBASE_PROJECT_ID');
        if (!privateKey) missingKeys.push('FIREBASE_PRIVATE_KEY');
        if (!clientEmail) missingKeys.push('FIREBASE_CLIENT_EMAIL');

        this.logger.error(
          `[FIREBASE_CONFIG_ERROR] Missing Firebase configuration variables: ${missingKeys.join(', ')}`,
        );
        throw new Error('Missing Firebase configuration variables');
      }

      // Nettoyer la clé privée (enlever les \n échappés)
      const cleanPrivateKey = privateKey.replace(/\\n/g, '\n');

      this.app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          privateKey: cleanPrivateKey,
          clientEmail,
        }),
        projectId,
      });
    } catch (error) {
      this.logger.error(
        '[FIREBASE_INIT_ERROR] Failed to initialize Firebase Admin:',
        error,
      );

      throw error;
    }
  }

  /**
   * Obtenir l'instance Firebase Admin
   */
  getApp(): admin.app.App {
    if (!this.app) {
      this.logger.error('[FIREBASE_APP_ERROR] Firebase Admin not initialized');
      throw new Error('Firebase Admin not initialized');
    }
    return this.app;
  }

  /**
   * Obtenir le service Messaging
   */
  getMessaging(): admin.messaging.Messaging {
    try {
      const messaging = this.getApp().messaging();
      return messaging;
    } catch (error) {
      this.logger.error(
        '[FIREBASE_MESSAGING_ERROR] Failed to get messaging service:',
        error,
      );
      throw error;
    }
  }

  /**
   * Envoyer une notification à un token spécifique
   */
  async sendToToken(
    token: string,
    notification: {
      title: string;
      body: string;
    },
    data?: Record<string, string>,
    badgeCount?: number,
  ): Promise<string> {
    try {
      const message: admin.messaging.Message = {
        token,
        notification,
        data,
        android: {
          priority: 'high',
          notification: {
            priority: 'high',
            defaultSound: true,
            defaultVibrateTimings: true,
          },
        },
        apns: {
          payload: {
            aps: {
              alert: notification,
              sound: 'default',
              badge: badgeCount || 1,
            },
          },
        },
      };

      const messageId = await this.getMessaging().send(message);

      return messageId;
    } catch (error) {
      this.logger.error(
        `[SEND_TOKEN_ERROR] Failed to send message to token ${token.substring(0, 20)}...:`,
        error,
      );

      throw error;
    }
  }
}
