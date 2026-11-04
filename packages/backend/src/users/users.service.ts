import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { UpdateUserDto } from './users.dto';

// What other users may see. Health data, push tokens and auth IDs stay private.
export const PUBLIC_USER_FIELDS = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  primaryGoal: true,
  createdAt: true,
} as const;

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
  constructor(private prisma: PrismaService) {}

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

  async findPublicById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: PUBLIC_USER_FIELDS,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateUser(supabaseId: string, data: UpdateUserDto) {
    return this.prisma.user.upsert({
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
