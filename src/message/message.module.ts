// src/message/message.module.ts
import { Module } from '@nestjs/common';
import { MessageController } from './message.controller';
import { MessageService } from './message.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { MediaModule } from '@/media/media.module';

@Module({
  imports: [PrismaModule, MediaModule],
  controllers: [MessageController],
  providers: [MessageService],
  exports: [MessageService],
})
export class MessageModule {}
