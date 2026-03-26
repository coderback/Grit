import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async upsertUser(
    supabaseId: string,
    data?: { displayName?: string; email?: string },
  ) {
    // Generate a username from display name or email
    const base =
      data?.displayName?.toLowerCase().replace(/\s+/g, '_') ??
      data?.email?.split('@')[0] ??
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

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateUser(
    supabaseId: string,
    data: {
      displayName?: string;
      avatarUrl?: string;
      calorieGoal?: number;
      weightKg?: number;
      primaryGoal?: string;
      heightCm?: number;
      activityLevel?: string;
      gender?: string;
      dateOfBirth?: string;
    },
  ) {
    return this.prisma.user.upsert({
      where: { supabaseId },
      update: data,
      create: {
        supabaseId,
        username: `user_${supabaseId.slice(0, 8)}`,
        displayName: data.displayName ?? `user_${supabaseId.slice(0, 8)}`,
        ...data,
      },
    });
  }
}
