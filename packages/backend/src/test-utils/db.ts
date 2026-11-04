import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import type {
  ExpoPushService,
  PushMessage,
} from '../notifications/expo-push.service';
import { NotificationsService } from '../notifications/notifications.service';

/** Records pushes instead of sending them. */
export class FakePush {
  sent: PushMessage[] = [];
  dead = new Set<string>();
  send(messages: PushMessage[]): Promise<string[]> {
    this.sent.push(...messages);
    return Promise.resolve(
      messages.map((m) => m.to).filter((t) => this.dead.has(t)),
    );
  }
}

/**
 * Helpers for the database tests (`npm run test:db`), which run services
 * against a real Postgres from DATABASE_URL. Every user they create is
 * removed afterwards; deleting a user cascades to everything they own.
 */
export class TestDb {
  readonly prisma = new PrismaService();
  private created: string[] = [];
  readonly push = new FakePush();
  readonly notifications = new NotificationsService(
    this.prisma,
    this.push as unknown as ExpoPushService,
  );

  async user(overrides: { displayName?: string; isPrivate?: boolean } = {}) {
    const supabaseId = randomUUID();
    const suffix = supabaseId.slice(0, 8);
    const user = await this.prisma.user.create({
      data: {
        supabaseId,
        username: `t_${overrides.displayName?.toLowerCase() ?? 'user'}_${suffix}`,
        displayName: overrides.displayName ?? `Test ${suffix}`,
        isPrivate: overrides.isPrivate ?? true,
      },
    });
    this.created.push(user.id);
    return user;
  }

  async cleanup() {
    await this.prisma.user.deleteMany({ where: { id: { in: this.created } } });
    this.created = [];
    await this.prisma.$disconnect();
  }
}
