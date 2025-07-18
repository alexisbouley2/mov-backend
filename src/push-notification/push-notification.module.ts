import { Module } from '@nestjs/common';
import { PushNotificationService } from './push-notification.service';
import { PushNotificationController } from './push-notification.controller';
import { FCMService } from './fcm.service';
import { FirebaseAdminService } from './firebase-admin.service';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PushNotificationController],
  providers: [PushNotificationService, FCMService, FirebaseAdminService],
  exports: [PushNotificationService, FCMService, FirebaseAdminService], // Exporter les services pour qu'ils puissent être utilisés dans d'autres modules
})
export class PushNotificationModule {}
