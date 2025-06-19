import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { PrismaModule } from '@/prisma/prisma.module';
import { MediaModule } from '@/media/media.module';
import { SupabaseModule } from '@/supabase/supabase.module';

@Module({
  imports: [MediaModule, SupabaseModule, PrismaModule],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
