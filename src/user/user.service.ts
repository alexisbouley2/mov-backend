import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { MediaService } from '@/media/media.service';
import { SupabaseService } from '@/supabase/supabase.service';
import { Logger } from '@nestjs/common';
import {
  User,
  UpdateUserRequest,
  UpdateUserResponse,
  DeleteUserResponse,
} from '@movapp/types';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private prisma: PrismaService,
    private mediaService: MediaService,
    private supabaseService: SupabaseService,
  ) {}

  async findOne(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) return null;

    let profileImageUrl: string | null = null;
    if (user.profileImagePath) {
      profileImageUrl = await this.mediaService.getPresignedDownloadUrl(
        user.profileImagePath,
      );
    }

    let profileThumbnailUrl: string | null = null;
    if (user.profileThumbnailPath) {
      profileThumbnailUrl = await this.mediaService.getPresignedDownloadUrl(
        user.profileThumbnailPath,
      );
    }

    return { ...user, profileImageUrl, profileThumbnailUrl };
  }

  async update(
    id: string,
    data: UpdateUserRequest,
  ): Promise<UpdateUserResponse> {
    // Get current user to check for existing photos
    const currentUser = await this.prisma.user.findUnique({
      where: { id },
      select: { profileImagePath: true, profileThumbnailPath: true },
    });

    // Delete old photos if they exist and we're updating with new ones
    if (
      currentUser?.profileImagePath &&
      currentUser?.profileThumbnailPath &&
      (data.profileImagePath || data.profileThumbnailPath)
    ) {
      try {
        await this.mediaService.deleteMultipleFiles([
          currentUser.profileImagePath,
          currentUser.profileThumbnailPath,
        ]);
      } catch (error) {
        this.logger.error('Failed to delete old user photos:', error);
      }
    }

    const updatedUser = await this.prisma.user.update({ where: { id }, data });

    let profileImageUrl: string | null = null;
    if (updatedUser.profileImagePath) {
      profileImageUrl = await this.mediaService.getPresignedDownloadUrl(
        updatedUser.profileImagePath,
      );
    }

    let profileThumbnailUrl: string | null = null;
    if (updatedUser.profileThumbnailPath) {
      profileThumbnailUrl = await this.mediaService.getPresignedDownloadUrl(
        updatedUser.profileThumbnailPath,
      );
    }

    const userWithUrls: User = {
      ...updatedUser,
      profileImageUrl,
      profileThumbnailUrl,
    };

    return {
      success: true,
      user: userWithUrls,
      message: 'User updated successfully',
    };
  }

  async remove(id: string): Promise<DeleteUserResponse> {
    // Get user data for cleanup
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { profileImagePath: true, profileThumbnailPath: true },
    });

    // Delete physical photo files
    if (user?.profileImagePath && user?.profileThumbnailPath) {
      try {
        await this.mediaService.deleteMultipleFiles([
          user.profileImagePath,
          user.profileThumbnailPath,
        ]);
      } catch (error) {
        this.logger.error('Failed to delete user photos:', error);
      }
    }

    // Hard delete from Supabase Auth (frees up phone number)
    try {
      const { error: authError } = await this.supabaseService.deleteUser(id);
      if (authError) {
        this.logger.error('Failed to delete from Supabase Auth:', authError);
      }
    } catch (error) {
      this.logger.error('Error deleting user from Supabase Auth:', error);
    }

    // Soft delete - anonymize user
    await this.prisma.user.update({
      where: { id },
      data: {
        phone: null, // Free up phone for reuse
        username: 'Deleted User',
        profileImagePath: null,
        profileThumbnailPath: null,
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    return {
      success: true,
      message: 'User deleted successfully',
    };
  }
}
