import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CYCLE_METRICS } from '../health/heart-rate';
import { WeightService } from '../progress/weight.service';
import type { UpdateUserDto } from './users.dto';
import {
  MIN_AGE,
  calorieFloor,
  hasProEdTerm,
  isUnderMinimumAge,
  weightLossAllowed,
} from '../common/safety';

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
    private weight: WeightService,
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

  async updateUser(supabaseId: string, data: UpdateUserDto, offset = 0) {
    if (data.avatarUrl) this.checkAvatarUrl(supabaseId, data.avatarUrl);
    await this.checkSafety(supabaseId, data);

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

    // A new weight from onboarding or the profile is also today's weigh-in
    if (data.weightKg !== undefined) {
      await this.weight.logForUser(user.id, data.weightKg, offset);
    }

    // Withdrawing cycle consent deletes the cycle data already imported
    if (data.consentCycleData === false) {
      await this.prisma.healthMetric.deleteMany({
        where: { userId: user.id, metric: { in: [...CYCLE_METRICS] } },
      });
    }

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
   * Profile rules that protect the user: adults only, no target below the
   * calorie floor, no weight-loss goal after a "yes" to the eating-disorder
   * question, and no pro-eating-disorder display names. Changes `data` to
   * switch a weight-loss goal to maintenance when that answer changes.
   */
  private async checkSafety(supabaseId: string, data: UpdateUserDto) {
    if (data.dateOfBirth && isUnderMinimumAge(new Date(data.dateOfBirth))) {
      throw new BadRequestException(
        `GRIT is for adults aged ${MIN_AGE} and over.`,
      );
    }
    if (hasProEdTerm(data.displayName)) {
      throw new BadRequestException("That name isn't allowed on GRIT.");
    }
    const existing = await this.prisma.user.findUnique({
      where: { supabaseId },
      select: { gender: true, edScreen: true, primaryGoal: true },
    });
    const edScreen = data.edScreen ?? existing?.edScreen;
    if (!weightLossAllowed(edScreen)) {
      if (data.primaryGoal === 'lose_weight') {
        throw new BadRequestException(
          "GRIT doesn't set weight-loss goals for you. Maintaining or building habits are available.",
        );
      }
      if (!data.primaryGoal && existing?.primaryGoal === 'lose_weight') {
        data.primaryGoal = 'maintain';
      }
    }
    if (data.calorieGoal !== undefined) {
      const floor = calorieFloor(data.gender ?? existing?.gender);
      if (data.calorieGoal < floor) {
        throw new BadRequestException(
          `GRIT doesn't set daily targets below ${floor.toLocaleString('en-US')} kcal: lower targets need medical supervision.`,
        );
      }
    }
  }

  /** Records (or withdraws) permission to send meals and chats to the AI. */
  async setAiConsent(supabaseId: string, granted: boolean) {
    return this.prisma.user.update({
      where: { supabaseId },
      data: { aiConsentAt: granted ? new Date() : null },
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
