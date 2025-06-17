import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private mediaService: MediaService,
    private supabaseService: SupabaseService,
  ) {}

  async create(data: {
    phone: string;
    username: string;
    photoStoragePath?: string;
    photoThumbnailPath?: string;
  }) {
    return this.prisma.user.create({ data });
  }

  async findAll() {
    const users = await this.prisma.user.findMany();

    // Add photo URLs to each user
    return Promise.all(
      users.map(async (user) => {
        const photoUrls = await this.mediaService.getUserPhotoUrls({
          photoStoragePath: user.photoStoragePath ?? undefined,
          photoThumbnailPath: user.photoThumbnailPath ?? undefined,
        });
        return { ...user, ...photoUrls };
      }),
    );
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) return null;

    const photoUrls = await this.mediaService.getUserPhotoUrls({
      photoStoragePath: user.photoStoragePath ?? undefined,
      photoThumbnailPath: user.photoThumbnailPath ?? undefined,
    });
    return { ...user, ...photoUrls };
  }

  async findByPhone(phone: string) {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) return null;

    const photoUrls = await this.mediaService.getUserPhotoUrls({
      photoStoragePath: user.photoStoragePath ?? undefined,
      photoThumbnailPath: user.photoThumbnailPath ?? undefined,
    });
    return { ...user, ...photoUrls };
  }

  async update(
    id: string,
    data: {
      username?: string;
      photoStoragePath?: string;
      photoThumbnailPath?: string;
    },
  ) {
    // Get current user to check for existing photos
    const currentUser = await this.prisma.user.findUnique({
      where: { id },
      select: { photoStoragePath: true, photoThumbnailPath: true },
    });

    // Delete old photos if they exist and we're updating with new ones
    if (
      currentUser?.photoStoragePath &&
      currentUser?.photoThumbnailPath &&
      (data.photoStoragePath || data.photoThumbnailPath)
    ) {
      try {
        await this.mediaService.deletePhotoFiles(
          currentUser.photoStoragePath,
          currentUser.photoThumbnailPath,
        );
      } catch (error) {
        console.error('Failed to delete old user photos:', error);
      }
    }

    const updatedUser = await this.prisma.user.update({ where: { id }, data });
    const photoUrls = await this.mediaService.getUserPhotoUrls({
      photoStoragePath: updatedUser.photoStoragePath ?? undefined,
      photoThumbnailPath: updatedUser.photoThumbnailPath ?? undefined,
    });
    return { ...updatedUser, ...photoUrls };
  }

  async remove(id: string) {
    // Get user data for cleanup
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { photoStoragePath: true, photoThumbnailPath: true },
    });

    // Delete physical photo files
    if (user?.photoStoragePath && user?.photoThumbnailPath) {
      try {
        await this.mediaService.deletePhotoFiles(
          user.photoStoragePath,
          user.photoThumbnailPath,
        );
      } catch (error) {
        console.error('Failed to delete user photos:', error);
      }
    }

    // Hard delete from Supabase Auth (frees up phone number)
    try {
      const { error: authError } = await this.supabaseService.deleteUser(id);
      if (authError) {
        console.error('Failed to delete from Supabase Auth:', authError);
      }
    } catch (error) {
      console.error('Error deleting user from Supabase Auth:', error);
    }

    // Soft delete - anonymize user
    return this.prisma.user.update({
      where: { id },
      data: {
        phone: null, // Free up phone for reuse
        username: 'Deleted User', // What others will see
        photoStoragePath: null,
        photoThumbnailPath: null,
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }
}
