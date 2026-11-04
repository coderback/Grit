import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { dayRange, localToday, weekStart } from '../common/day';

export type FeedItemType = 'food_log' | 'activity_log' | 'habit_log';

export interface FeedItem {
  id: string;
  type: FeedItemType;
  loggedAt: Date;
  // Pass the last item's cursor back to load the items after it
  cursor: string;
  user: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    username: string;
  };
  data: Record<string, unknown>;
}

const FEED_DAYS = 7;

/**
 * Feed position: time, then type and id to break ties. Many items share a
 * timestamp (bulk imports, same-second logs), so time alone would skip some.
 */
interface FeedCursor {
  time: Date;
  type: FeedItemType;
  id: string;
}

export function encodeFeedCursor(c: FeedCursor): string {
  return `${c.time.toISOString()}|${c.type}|${c.id}`;
}

export function decodeFeedCursor(raw: string): FeedCursor | null {
  const [iso, type, id] = raw.split('|');
  const time = new Date(iso);
  const types: FeedItemType[] = ['food_log', 'activity_log', 'habit_log'];
  if (Number.isNaN(time.getTime()) || !types.includes(type as FeedItemType)) {
    return null;
  }
  if (!id) return null;
  return { time, type: type as FeedItemType, id };
}

/** Newest first; ties broken by type, then id, both descending. */
function compareFeed(a: FeedCursor, b: FeedCursor): number {
  return (
    b.time.getTime() - a.time.getTime() ||
    (a.type < b.type ? 1 : a.type > b.type ? -1 : 0) ||
    (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)
  );
}

/**
 * Prisma filter for one log table: rows in the feed window that sort after
 * the cursor. `field` is the timestamp the feed orders that table by.
 */
function afterCursor(
  field: 'loggedAt' | 'createdAt',
  type: FeedItemType,
  since: Date,
  now: Date,
  cursor: FeedCursor | null,
) {
  if (!cursor) return { [field]: { gte: since, lte: now } };
  const older = { [field]: { gte: since, lt: cursor.time } };
  // Same timestamp: tables whose type sorts before the cursor's were not
  // reached yet, the cursor's own table continues by id
  if (type < cursor.type) {
    return { [field]: { gte: since, lte: cursor.time } };
  }
  if (type > cursor.type) return older;
  return {
    OR: [older, { [field]: cursor.time, id: { lt: cursor.id } }],
  };
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
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });
    if (!target) throw new NotFoundException('User not found');

    return this.prisma.follow.upsert({
      where: {
        followerId_followingId: {
          followerId: actor.id,
          followingId: targetUserId,
        },
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
        following: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  async getFollowers(supabaseId: string) {
    const user = await this.resolveUser(supabaseId);
    return this.prisma.follow.findMany({
      where: { followingId: user.id },
      include: {
        follower: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  // ── Feed ──────────────────────────────────────────────────────────────────

  async getFeed(
    supabaseId: string,
    cursor?: string,
    limit = 30,
  ): Promise<FeedItem[]> {
    const user = await this.resolveUser(supabaseId);

    // Who does this user follow?
    const follows = await this.prisma.follow.findMany({
      where: { followerId: user.id },
      select: { followingId: true },
    });
    const followedIds = follows.map((f) => f.followingId);

    if (followedIds.length === 0) return [];

    // Last 7 days, newest first. Nothing dated in the future: those would sit
    // at the top of everyone's feed.
    const now = new Date();
    const since = new Date(now.getTime() - FEED_DAYS * 24 * 60 * 60 * 1000);
    const after = cursor ? decodeFeedCursor(cursor) : null;
    if (cursor && !after) throw new BadRequestException('Invalid cursor');

    const userSelect = {
      id: true,
      displayName: true,
      avatarUrl: true,
      username: true,
    };

    // Fetch from all three log tables in parallel
    const [foodLogs, activityLogs, habitLogs] = await Promise.all([
      this.prisma.foodLog.findMany({
        where: {
          userId: { in: followedIds },
          ...afterCursor('loggedAt', 'food_log', since, now, after),
        },
        include: { user: { select: userSelect } },
        orderBy: [{ loggedAt: 'desc' }, { id: 'desc' }],
        take: limit,
      }),
      this.prisma.activityLog.findMany({
        where: {
          userId: { in: followedIds },
          ...afterCursor('loggedAt', 'activity_log', since, now, after),
        },
        include: {
          user: { select: userSelect },
          // Whether the viewer has already given kudos
          kudos: { where: { userId: user.id }, select: { id: true } },
        },
        orderBy: [{ loggedAt: 'desc' }, { id: 'desc' }],
        take: limit,
      }),
      this.prisma.habitLog.findMany({
        // Check-ins are dated by day, so order them by when they happened
        where: {
          userId: { in: followedIds },
          completed: true,
          ...afterCursor('createdAt', 'habit_log', since, now, after),
        },
        include: {
          user: { select: userSelect },
          habit: { select: { name: true, emoji: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
      }),
    ]);

    const items: Omit<FeedItem, 'cursor'>[] = [
      ...foodLogs.map((l) => ({
        id: l.id,
        type: 'food_log' as const,
        loggedAt: l.loggedAt,
        user: l.user,
        data: {
          name: l.name,
          calories: l.calories,
          mealType: l.mealType,
          brand: l.brand,
        },
      })),
      ...activityLogs.map((l) => ({
        id: l.id,
        type: 'activity_log' as const,
        loggedAt: l.loggedAt,
        user: l.user,
        data: {
          activityType: l.activityType,
          durationMin: l.durationMin,
          caloriesBurned: l.caloriesBurned,
          steps: l.steps,
          kudosCount: l.kudosCount,
          kudosGiven: l.kudos.length > 0,
        },
      })),
      ...habitLogs.map((l) => ({
        id: l.id,
        type: 'habit_log' as const,
        loggedAt: l.createdAt,
        user: l.user,
        data: { habitName: l.habit.name, habitEmoji: l.habit.emoji },
      })),
    ];

    return items
      .map((item) => ({ item, key: { ...item, time: item.loggedAt } }))
      .sort((a, b) => compareFeed(a.key, b.key))
      .slice(0, limit)
      .map(({ item, key }) => ({ ...item, cursor: encodeFeedCursor(key) }));
  }

  // ── Weekly leaderboard ────────────────────────────────────────────────────

  async getWeeklyLeaderboard(supabaseId: string, offset: number) {
    const user = await this.resolveUser(supabaseId);

    const follows = await this.prisma.follow.findMany({
      where: { followerId: user.id },
      select: { followingId: true },
    });
    // Include self in leaderboard
    const ids = [user.id, ...follows.map((f) => f.followingId)];

    const monday = dayRange(weekStart(localToday(offset)), offset).start;
    // Up to now, so a workout dated later this week doesn't count yet
    const now = new Date();

    const logs = await this.prisma.activityLog.groupBy({
      by: ['userId'],
      where: { userId: { in: ids }, loggedAt: { gte: monday, lte: now } },
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
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        primaryGoal: true,
        createdAt: true,
        _count: { select: { following: true, followers: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
