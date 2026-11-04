import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import type { UpdateUserDto } from './users.dto';

/** Usernames are lowercase letters, digits and underscores. */
function usernameBase(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 20);
}

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  /**
   * Profile photos must be the user's own upload in the app's avatars
   * bucket, so nobody can point their photo at an arbitrary URL.
   */
  private checkAvatarUrl(supabaseId: string, url: string) {
    const base = this.config.get<string>('SUPABASE_URL')?.replace(/\/$/, '');
    const prefix = `${base}/storage/v1/object/public/avatars/${supabaseId}/`;
    if (!base || !url.startsWith(prefix) || url.includes('..')) {
      throw new BadRequestException('avatarUrl must be an uploaded photo');
    }
  }

  async upsertUser(
    supabaseId: string,
    data?: { displayName?: string; email?: string },
  ) {
    // Generate a username from display name or email
    const base =
      usernameBase(data?.displayName ?? data?.email?.split('@')[0] ?? '') ||
      `user_${supabaseId.slice(0, 8)}`;

    return this.prisma.user.upsert({
      where: { supabaseId },
      update: {},
      create: {
        supabaseId,
        username: `${base}_${supabaseId.slice(0, 6)}`,
        displayName: data?.displayName ?? base,
      },
    });
  }

  async findBySupabaseId(supabaseId: string) {
    const user = await this.prisma.user.findUnique({ where: { supabaseId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  setUtcOffset(supabaseId: string, utcOffset: number) {
    return this.prisma.user.update({
      where: { supabaseId },
      data: { utcOffset },
    });
  }

  async updateUser(supabaseId: string, data: UpdateUserDto) {
    if (data.avatarUrl) this.checkAvatarUrl(supabaseId, data.avatarUrl);

    const user = await this.prisma.user.upsert({
      where: { supabaseId },
      update: data,
      create: {
        ...data,
        supabaseId,
        username: `user_${supabaseId.slice(0, 8)}`,
        // DTO fields that weren't sent are present as undefined, so set this last
        displayName: data.displayName ?? `user_${supabaseId.slice(0, 8)}`,
      },
    });

    // Going public approves everyone who was waiting
    if (data.isPrivate === false) {
      await this.prisma.follow.updateMany({
        where: { followingId: user.id, status: 'pending' },
        data: { status: 'accepted' },
      });
      await this.prisma.notification.deleteMany({
        where: { userId: user.id, type: 'follow_request' },
      });
    }
    return user;
  }

  /**
   * Permanently deletes the account: every row the user owns (the foreign
   * keys cascade) and their Supabase sign-in, in one transaction so neither
   * is left behind if the other fails.
   */
  async deleteAccount(supabaseId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.user.deleteMany({ where: { supabaseId } });

      // Supabase keeps sign-ins in auth.users, which the API's database role
      // can write to. A local database without Supabase has no auth schema.
      const [{ hasAuth }] = await tx.$queryRaw<{ hasAuth: boolean }[]>`
        SELECT to_regclass('auth.users') IS NOT NULL AS "hasAuth"`;
      if (hasAuth) {
        await tx.$executeRaw`DELETE FROM auth.users WHERE id = ${supabaseId}::uuid`;
      }
    });
  }
}
