import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type FeedItemType = 'food_log' | 'activity_log' | 'habit_log';

export interface FeedItem {
  id: string;
  type: FeedItemType;
  loggedAt: Date;
  user: { id: string; displayName: string; avatarUrl: string | null; username: string };
  data: Record<string, unknown>;
}

@Injectable()
export class SocialService {
  constructor(private prisma: PrismaService) {}

  private async resolveUser(supabaseId: string) {
    const user = await this.prisma.user.findUnique({ where: { supabaseId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // ── Follow / Unfollow ─────────────────────────────────────────────────────

  async follow(actorSupabaseId: string, targetUserId: string) {
    const actor = await this.resolveUser(actorSupabaseId);
    if (actor.id === targetUserId) {
      throw new ConflictException('Cannot follow yourself');
    }
    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new NotFoundException('User not found');

    return this.prisma.follow.upsert({
      where: {
        followerId_followingId: { followerId: actor.id, followingId: targetUserId },
      },
      update: {},
      create: { followerId: actor.id, followingId: targetUserId },
    });
  }

  async unfollow(actorSupabaseId: string, targetUserId: string) {
    const actor = await this.resolveUser(actorSupabaseId);
    await this.prisma.follow.deleteMany({
      where: { followerId: actor.id, followingId: targetUserId },
    });
    return { ok: true };
  }

  async getFollowing(supabaseId: string) {
    const user = await this.resolveUser(supabaseId);
    return this.prisma.follow.findMany({
      where: { followerId: user.id },
      include: {
        following: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
    });
  }

  async getFollowers(supabaseId: string) {
    const user = await this.resolveUser(supabaseId);
    return this.prisma.follow.findMany({
      where: { followingId: user.id },
      include: {
        follower: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
    });
  }

  // ── Feed ──────────────────────────────────────────────────────────────────

  async getFeed(supabaseId: string, cursor?: string, limit = 30): Promise<FeedItem[]> {
    const user = await this.resolveUser(supabaseId);

    // Who does this user follow?
    const follows = await this.prisma.follow.findMany({
      where: { followerId: user.id },
      select: { followingId: true },
    });
    const followedIds = follows.map((f) => f.followingId);

    if (followedIds.length === 0) return [];

    const since = cursor ? new Date(cursor) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const userSelect = {
      id: true, displayName: true, avatarUrl: true, username: true,
    };

    // Fetch from all three log tables in parallel
    const [foodLogs, activityLogs, habitLogs] = await Promise.all([
      this.prisma.foodLog.findMany({
        where: { userId: { in: followedIds }, loggedAt: { gte: since } },
        include: { user: { select: userSelect } },
        orderBy: { loggedAt: 'desc' },
        take: limit,
      }),
      this.prisma.activityLog.findMany({
        where: { userId: { in: followedIds }, loggedAt: { gte: since } },
        include: { user: { select: userSelect } },
        orderBy: { loggedAt: 'desc' },
        take: limit,
      }),
      this.prisma.habitLog.findMany({
        where: {
          userId: { in: followedIds },
          loggedAt: { gte: since },
          completed: true,
        },
        include: {
          user: { select: userSelect },
          habit: { select: { name: true, emoji: true } },
        },
        orderBy: { loggedAt: 'desc' },
        take: limit,
      }),
    ]);

    const items: FeedItem[] = [
      ...foodLogs.map((l) => ({
        id: l.id,
        type: 'food_log' as FeedItemType,
        loggedAt: l.loggedAt,
        user: l.user,
        data: { name: l.name, calories: l.calories, mealType: l.mealType, brand: l.brand },
      })),
      ...activityLogs.map((l) => ({
        id: l.id,
        type: 'activity_log' as FeedItemType,
        loggedAt: l.loggedAt,
        user: l.user,
        data: {
          activityType: l.activityType,
          durationMin: l.durationMin,
          caloriesBurned: l.caloriesBurned,
          steps: l.steps,
          kudosCount: l.kudosCount,
        },
      })),
      ...habitLogs.map((l) => ({
        id: l.id,
        type: 'habit_log' as FeedItemType,
        loggedAt: l.loggedAt,
        user: l.user,
        data: { habitName: l.habit.name, habitEmoji: l.habit.emoji },
      })),
    ];

    return items.sort((a, b) => b.loggedAt.getTime() - a.loggedAt.getTime()).slice(0, limit);
  }

  // ── Weekly leaderboard ────────────────────────────────────────────────────

  async getWeeklyLeaderboard(supabaseId: string) {
    const user = await this.resolveUser(supabaseId);

    const follows = await this.prisma.follow.findMany({
      where: { followerId: user.id },
      select: { followingId: true },
    });
    // Include self in leaderboard
    const ids = [user.id, ...follows.map((f) => f.followingId)];

    const monday = new Date();
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);

    const logs = await this.prisma.activityLog.groupBy({
      by: ['userId'],
      where: { userId: { in: ids }, loggedAt: { gte: monday } },
      _sum: { durationMin: true, steps: true },
    });

    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, displayName: true, avatarUrl: true, username: true },
    });

    const logMap = new Map(logs.map((l) => [l.userId, l._sum]));

    return users
      .map((u) => ({
        user: u,
        activeMinutes: logMap.get(u.id)?.durationMin ?? 0,
        steps: logMap.get(u.id)?.steps ?? 0,
        isMe: u.id === user.id,
      }))
      .sort((a, b) => (b.activeMinutes ?? 0) - (a.activeMinutes ?? 0));
  }

  async getPublicProfile(targetUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true, username: true, displayName: true, avatarUrl: true,
        primaryGoal: true, createdAt: true,
        _count: { select: { following: true, followers: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
