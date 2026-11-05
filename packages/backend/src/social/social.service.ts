import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { dayRange, localToday, weekStart } from '../common/day';
import { PrivacyService, type Relationship } from './privacy.service';
import { NotificationsService } from '../notifications/notifications.service';

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

// What other users see of someone in lists, the feed and search
const PUBLIC_USER = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} as const;

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
  constructor(
    private prisma: PrismaService,
    private privacy: PrivacyService,
    private notifications: NotificationsService,
  ) {}

  private async resolveUser(supabaseId: string) {
    const user = await this.prisma.user.findUnique({ where: { supabaseId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * Another user the viewer may interact with: exists and no block either
   * way. With `allowOwnBlock`, someone the viewer blocked still resolves (so
   * they can be unblocked from their profile); being blocked never does.
   */
  private async visibleUser(
    viewerId: string,
    targetId: string,
    allowOwnBlock = false,
  ) {
    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
    });
    const hidden = allowOwnBlock
      ? await this.prisma.block.findUnique({
          where: {
            blockerId_blockedId: { blockerId: targetId, blockedId: viewerId },
          },
        })
      : await this.privacy.isBlockedEitherWay(viewerId, targetId);
    if (!target || hidden) throw new NotFoundException('User not found');
    return target;
  }

  // ── Follow / Unfollow ─────────────────────────────────────────────────────

  /** Follows a public account straight away; asks a private one for approval. */
  async follow(actorSupabaseId: string, targetUserId: string) {
    const actor = await this.resolveUser(actorSupabaseId);
    if (actor.id === targetUserId) {
      throw new ConflictException('Cannot follow yourself');
    }
    const target = await this.visibleUser(actor.id, targetUserId);

    const where = {
      followerId_followingId: { followerId: actor.id, followingId: target.id },
    };
    const existing = await this.prisma.follow.findUnique({ where });
    if (existing) return { status: existing.status as 'pending' | 'accepted' };

    const status = target.isPrivate ? 'pending' : 'accepted';
    await this.prisma.follow.upsert({
      where,
      update: {},
      create: { followerId: actor.id, followingId: target.id, status },
    });

    // One alert per person: unfollowing and following again doesn't repeat it
    this.notifications.notifyQuietly(
      target.id,
      status === 'pending'
        ? {
            type: 'follow_request',
            actorId: actor.id,
            title: 'New follow request',
            body: `${actor.displayName} wants to follow you`,
            data: { userId: actor.id },
            dedupeKey: `follow_request:${actor.id}`,
          }
        : {
            type: 'follow',
            actorId: actor.id,
            title: 'New follower',
            body: `${actor.displayName} started following you`,
            data: { userId: actor.id },
            dedupeKey: `follow:${actor.id}`,
          },
    );
    return { status };
  }

  /** Unfollows, or withdraws a request that hasn't been answered yet. */
  async unfollow(actorSupabaseId: string, targetUserId: string) {
    const actor = await this.resolveUser(actorSupabaseId);
    await this.prisma.follow.deleteMany({
      where: { followerId: actor.id, followingId: targetUserId },
    });
    // A withdrawn request shouldn't wait in their inbox
    await this.notifications.retract(
      targetUserId,
      `follow_request:${actor.id}`,
    );
    return { ok: true };
  }

  async getFollowRequests(supabaseId: string) {
    const user = await this.resolveUser(supabaseId);
    const requests = await this.prisma.follow.findMany({
      where: { followingId: user.id, status: 'pending' },
      include: { follower: { select: PUBLIC_USER } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return requests.map((r) => ({ createdAt: r.createdAt, user: r.follower }));
  }

  async acceptFollowRequest(supabaseId: string, followerId: string) {
    const user = await this.resolveUser(supabaseId);
    const { count } = await this.prisma.follow.updateMany({
      where: { followerId, followingId: user.id, status: 'pending' },
      data: { status: 'accepted' },
    });
    if (count === 0) throw new NotFoundException('Follow request not found');
    await this.notifications.retract(user.id, `follow_request:${followerId}`);
    this.notifications.notifyQuietly(followerId, {
      type: 'follow_accepted',
      actorId: user.id,
      title: 'Request accepted',
      body: `${user.displayName} accepted your follow request`,
      data: { userId: user.id },
      dedupeKey: `follow_accepted:${user.id}`,
    });
    return { ok: true };
  }

  async declineFollowRequest(supabaseId: string, followerId: string) {
    const user = await this.resolveUser(supabaseId);
    await this.prisma.follow.deleteMany({
      where: { followerId, followingId: user.id, status: 'pending' },
    });
    await this.notifications.retract(user.id, `follow_request:${followerId}`);
    return { ok: true };
  }

  /** Stops someone following you, without blocking them. */
  async removeFollower(supabaseId: string, followerId: string) {
    const user = await this.resolveUser(supabaseId);
    await this.prisma.follow.deleteMany({
      where: { followerId, followingId: user.id },
    });
    return { ok: true };
  }

  /**
   * Approved followers or followings of a user, with the viewer's relationship
   * to each. Private accounts only show these to their approved followers.
   */
  async listConnections(
    viewerSupabaseId: string,
    targetUserId: string,
    which: 'followers' | 'following',
  ) {
    const viewer = await this.resolveUser(viewerSupabaseId);
    const targetId = targetUserId === 'me' ? viewer.id : targetUserId;
    if (targetId !== viewer.id) await this.visibleUser(viewer.id, targetId);
    if (!(await this.privacy.canView(viewer.id, targetId))) {
      throw new ForbiddenException('This account is private');
    }

    const hidden = await this.privacy.blockedIds(viewer.id);
    const rows = await this.prisma.follow.findMany({
      where:
        which === 'followers'
          ? {
              followingId: targetId,
              status: 'accepted',
              followerId: { notIn: hidden },
            }
          : {
              followerId: targetId,
              status: 'accepted',
              followingId: { notIn: hidden },
            },
      include: {
        follower: { select: PUBLIC_USER },
        following: { select: PUBLIC_USER },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    const users = rows.map((r) =>
      which === 'followers' ? r.follower : r.following,
    );
    return this.withRelationships(viewer.id, users);
  }

  private async withRelationships<T extends { id: string }>(
    viewerId: string,
    users: T[],
  ): Promise<(T & { relationship: Relationship; isMe: boolean })[]> {
    const others = users.filter((u) => u.id !== viewerId).map((u) => u.id);
    const rel = await this.privacy.relationships(viewerId, others);
    return users.map((u) => ({
      ...u,
      isMe: u.id === viewerId,
      relationship: rel.get(u.id) ?? {
        following: 'none',
        followsYou: 'none',
        blocked: false,
      },
    }));
  }

  // ── Search ────────────────────────────────────────────────────────────────

  /** Finds people by username or name, hiding anyone on either side of a block. */
  async searchUsers(supabaseId: string, query: string) {
    const viewer = await this.resolveUser(supabaseId);
    const q = query.trim().replace(/^@/, '');
    if (q.length < 2) return [];

    const hidden = await this.privacy.blockedIds(viewer.id);
    const users = await this.prisma.user.findMany({
      where: {
        id: { notIn: [viewer.id, ...hidden] },
        OR: [
          { username: { contains: q, mode: 'insensitive' } },
          { displayName: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: PUBLIC_USER,
      orderBy: { username: 'asc' },
      take: 20,
    });

    // Exact and prefix username matches first
    const lower = q.toLowerCase();
    const rank = (u: { username: string }) =>
      u.username === lower ? 0 : u.username.startsWith(lower) ? 1 : 2;
    users.sort((a, b) => rank(a) - rank(b));

    return this.withRelationships(viewer.id, users);
  }

  // ── Blocking ──────────────────────────────────────────────────────────────

  /** Blocks a user and removes any follow between the two, in both directions. */
  async block(supabaseId: string, targetUserId: string) {
    const user = await this.resolveUser(supabaseId);
    if (user.id === targetUserId) {
      throw new ConflictException('Cannot block yourself');
    }
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });
    if (!target) throw new NotFoundException('User not found');

    await this.prisma.$transaction([
      this.prisma.block.upsert({
        where: {
          blockerId_blockedId: { blockerId: user.id, blockedId: target.id },
        },
        update: {},
        create: { blockerId: user.id, blockedId: target.id },
      }),
      this.prisma.follow.deleteMany({
        where: {
          OR: [
            { followerId: user.id, followingId: target.id },
            { followerId: target.id, followingId: user.id },
          ],
        },
      }),
    ]);
    await this.notifications.forgetBetween(user.id, target.id);
    return { ok: true };
  }

  async unblock(supabaseId: string, targetUserId: string) {
    const user = await this.resolveUser(supabaseId);
    await this.prisma.block.deleteMany({
      where: { blockerId: user.id, blockedId: targetUserId },
    });
    return { ok: true };
  }

  async getBlocked(supabaseId: string) {
    const user = await this.resolveUser(supabaseId);
    const blocks = await this.prisma.block.findMany({
      where: { blockerId: user.id },
      include: { blocked: { select: PUBLIC_USER } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return blocks.map((b) => ({ createdAt: b.createdAt, user: b.blocked }));
  }

  // ── Feed ──────────────────────────────────────────────────────────────────

  /** Recent activity of the people the user follows (approved follows only). */
  async getFeed(
    supabaseId: string,
    cursor?: string,
    limit = 30,
  ): Promise<FeedItem[]> {
    const user = await this.resolveUser(supabaseId);
    const follows = await this.prisma.follow.findMany({
      where: {
        followerId: user.id,
        status: 'accepted',
        // Blocking removes follows; this covers any left behind
        followingId: { notIn: await this.privacy.blockedIds(user.id) },
      },
      select: { followingId: true },
    });
    return this.feedFor(
      user.id,
      follows.map((f) => f.followingId),
      cursor,
      limit,
    );
  }

  /**
   * Activity from the last 7 days by `authorIds`, newest first, starting
   * after `cursor`. The caller checks the viewer may see these authors.
   */
  private async feedFor(
    viewerId: string,
    authorIds: string[],
    cursor: string | undefined,
    limit: number,
  ): Promise<FeedItem[]> {
    if (authorIds.length === 0) return [];

    // Nothing dated in the future: those would sit at the top of everyone's feed
    const now = new Date();
    const since = new Date(now.getTime() - FEED_DAYS * 24 * 60 * 60 * 1000);
    const after = cursor ? decodeFeedCursor(cursor) : null;
    if (cursor && !after) throw new BadRequestException('Invalid cursor');

    const userSelect = PUBLIC_USER;

    // Fetch from all three log tables in parallel
    const [foodLogs, activityLogs, habitLogs] = await Promise.all([
      this.prisma.foodLog.findMany({
        where: {
          userId: { in: authorIds },
          ...afterCursor('loggedAt', 'food_log', since, now, after),
        },
        include: { user: { select: userSelect } },
        orderBy: [{ loggedAt: 'desc' }, { id: 'desc' }],
        take: limit,
      }),
      this.prisma.activityLog.findMany({
        where: {
          userId: { in: authorIds },
          ...afterCursor('loggedAt', 'activity_log', since, now, after),
        },
        include: {
          user: { select: userSelect },
          // Whether the viewer has already given kudos
          kudos: { where: { userId: viewerId }, select: { id: true } },
        },
        orderBy: [{ loggedAt: 'desc' }, { id: 'desc' }],
        take: limit,
      }),
      this.prisma.habitLog.findMany({
        // Check-ins are dated by day, so order them by when they happened
        where: {
          userId: { in: authorIds },
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
      where: {
        followerId: user.id,
        status: 'accepted',
        followingId: { notIn: await this.privacy.blockedIds(user.id) },
      },
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
      select: PUBLIC_USER,
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

  // ── Profiles ──────────────────────────────────────────────────────────────

  /**
   * A user's profile as the viewer may see it. Everyone (bar blocked users)
   * sees the name, photo and counts; this week's stats and recent activity
   * need `canView`.
   */
  async getProfile(
    viewerSupabaseId: string,
    targetUserId: string,
    offset: number,
  ) {
    const viewer = await this.resolveUser(viewerSupabaseId);
    const targetId = targetUserId === 'me' ? viewer.id : targetUserId;
    if (targetId !== viewer.id) {
      await this.visibleUser(viewer.id, targetId, true);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: {
        ...PUBLIC_USER,
        primaryGoal: true,
        createdAt: true,
        isPrivate: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const [followers, following, relationship, canView] = await Promise.all([
      this.prisma.follow.count({
        where: { followingId: targetId, status: 'accepted' },
      }),
      this.prisma.follow.count({
        where: { followerId: targetId, status: 'accepted' },
      }),
      targetId === viewer.id
        ? null
        : this.privacy.relationship(viewer.id, targetId),
      this.privacy.canView(viewer.id, targetId),
    ]);

    let week: { activeMinutes: number; workouts: number } | null = null;
    let recent: FeedItem[] = [];
    if (canView) {
      const monday = dayRange(weekStart(localToday(offset)), offset).start;
      const [agg, items] = await Promise.all([
        this.prisma.activityLog.aggregate({
          where: {
            userId: targetId,
            loggedAt: { gte: monday, lte: new Date() },
          },
          _sum: { durationMin: true },
          _count: { _all: true },
        }),
        this.feedFor(viewer.id, [targetId], undefined, 10),
      ]);
      week = {
        activeMinutes: agg._sum.durationMin ?? 0,
        workouts: agg._count._all,
      };
      recent = items;
    }

    return {
      ...user,
      isMe: targetId === viewer.id,
      _count: { followers, following },
      relationship,
      canView,
      week,
      recent,
    };
  }
}
