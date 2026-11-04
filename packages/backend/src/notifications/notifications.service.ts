import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ExpoPushService } from './expo-push.service';

export type NotificationType =
  | 'follow'
  | 'follow_request'
  | 'follow_accepted'
  | 'kudos'
  | 'challenge_joined'
  | 'challenge_ended'
  | 'streak_at_risk'
  | 'weekly_progress';

export interface NewNotification {
  type: NotificationType;
  actorId?: string;
  title: string;
  body: string;
  data?: Record<string, string | number | boolean>;
  /** Unique per user: a second alert with the same key is dropped */
  dedupeKey?: string;
}

const SOCIAL: NotificationType[] = [
  'follow',
  'follow_request',
  'follow_accepted',
  'kudos',
  'challenge_joined',
];
const PAGE = 50;
const KEEP_DAYS = 90;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private push: ExpoPushService,
  ) {}

  private async resolveUser(supabaseId: string) {
    const user = await this.prisma.user.findUnique({ where: { supabaseId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // ── Devices ─────────────────────────────────────────────────────────────

  /** Adds this phone to the account. A token moves if someone else signs in on it. */
  async registerToken(supabaseId: string, token: string, platform: string) {
    const user = await this.resolveUser(supabaseId);
    await this.prisma.pushDevice.upsert({
      where: { token },
      update: { userId: user.id, platform },
      create: { userId: user.id, token, platform },
    });
    return { ok: true };
  }

  /** Called on sign-out so the phone stops getting this account's alerts. */
  async unregisterToken(supabaseId: string, token: string) {
    const user = await this.resolveUser(supabaseId);
    await this.prisma.pushDevice.deleteMany({
      where: { token, userId: user.id },
    });
    return { ok: true };
  }

  // ── Sending ─────────────────────────────────────────────────────────────

  /**
   * Adds an alert to the user's inbox and pushes it to their phones if their
   * settings allow. Returns false if it was a duplicate. Social alerts always
   * reach the inbox; `notifSocial` only controls the push.
   */
  async notify(userId: string, n: NewNotification): Promise<boolean> {
    let created;
    try {
      created = await this.prisma.notification.create({
        data: {
          userId,
          type: n.type,
          actorId: n.actorId,
          title: n.title,
          body: n.body,
          data: n.data ?? {},
          dedupeKey: n.dedupeKey,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        return false;
      }
      throw err;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        notifSocial: true,
        pushDevices: { select: { token: true } },
      },
    });
    if (!user || user.pushDevices.length === 0) return true;
    if (SOCIAL.includes(n.type) && !user.notifSocial) return true;

    const unread = await this.prisma.notification.count({
      where: { userId, readAt: null },
    });
    const dead = await this.push.send(
      user.pushDevices.map((d) => ({
        to: d.token,
        title: n.title,
        body: n.body,
        badge: unread,
        data: { ...n.data, type: n.type, notificationId: created.id },
      })),
    );
    if (dead.length > 0) {
      await this.prisma.pushDevice.deleteMany({
        where: { token: { in: dead } },
      });
    }
    return true;
  }

  /** `notify` for side effects of a user's action: logs instead of failing it. */
  notifyQuietly(userId: string, n: NewNotification): void {
    this.notify(userId, n).catch((err: Error) =>
      this.logger.warn(`Notification ${n.type} failed: ${err.message}`),
    );
  }

  /** Withdraws an alert that no longer applies, e.g. an answered follow request. */
  async retract(userId: string, dedupeKey: string) {
    await this.prisma.notification.deleteMany({ where: { userId, dedupeKey } });
  }

  /** Drops alerts between two users, both ways (after a block). */
  async forgetBetween(a: string, b: string) {
    await this.prisma.notification.deleteMany({
      where: {
        OR: [
          { userId: a, actorId: b },
          { userId: b, actorId: a },
        ],
      },
    });
  }

  // ── Inbox ───────────────────────────────────────────────────────────────

  /** Newest first, 50 at a time; pass the last item's id as `before` for more. */
  async list(supabaseId: string, before?: string) {
    const user = await this.resolveUser(supabaseId);
    const cursor = before
      ? await this.prisma.notification.findFirst({
          where: { id: before, userId: user.id },
          select: { createdAt: true, id: true },
        })
      : null;

    const items = await this.prisma.notification.findMany({
      where: {
        userId: user.id,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      include: {
        actor: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: PAGE,
    });
    const unread = await this.prisma.notification.count({
      where: { userId: user.id, readAt: null },
    });
    return {
      // The dedupe key and recipient are internal
      items: items.map((n) => {
        const { dedupeKey, userId, ...rest } = n;
        void dedupeKey;
        void userId;
        return rest;
      }),
      unread,
    };
  }

  async unreadCount(supabaseId: string) {
    const user = await this.resolveUser(supabaseId);
    const unread = await this.prisma.notification.count({
      where: { userId: user.id, readAt: null },
    });
    return { unread };
  }

  /** Marks the given alerts read, or all of them when no ids are given. */
  async markRead(supabaseId: string, ids?: string[]) {
    const user = await this.resolveUser(supabaseId);
    await this.prisma.notification.updateMany({
      where: {
        userId: user.id,
        readAt: null,
        ...(ids ? { id: { in: ids } } : {}),
      },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  /** Keeps the inbox to the last 90 days. */
  async prune() {
    const cutoff = new Date(Date.now() - KEEP_DAYS * 86_400_000);
    const { count } = await this.prisma.notification.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return count;
  }
}
