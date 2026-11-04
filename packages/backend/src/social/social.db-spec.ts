import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TestDb } from '../test-utils/db';
import { PrivacyService } from './privacy.service';
import { SocialService } from './social.service';

describe('SocialService (database)', () => {
  const db = new TestDb();
  const privacy = new PrivacyService(db.prisma);
  const social = new SocialService(db.prisma, privacy, db.notifications);
  // Alerts are sent without waiting; give them a moment to land
  const settle = () => new Promise((r) => setTimeout(r, 150));
  const inbox = (userId: string) =>
    db.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

  afterAll(() => db.cleanup());

  async function workout(userId: string) {
    return db.prisma.activityLog.create({
      data: { userId, activityType: 'running', durationMin: 30 },
    });
  }

  it('asks a private account for approval and hides its activity until then', async () => {
    const ana = await db.user({ displayName: 'Ana' });
    const ben = await db.user({ displayName: 'Ben', isPrivate: true });
    await workout(ben.id);

    expect(await social.follow(ana.supabaseId, ben.id)).toEqual({
      status: 'pending',
    });
    // Asking twice keeps one pending request
    expect(await social.follow(ana.supabaseId, ben.id)).toEqual({
      status: 'pending',
    });

    expect(await social.getFeed(ana.supabaseId)).toEqual([]);
    const before = await social.getProfile(ana.supabaseId, ben.id, 0);
    expect(before.canView).toBe(false);
    expect(before.recent).toEqual([]);
    expect(before.week).toBeNull();
    expect(before.relationship?.following).toBe('pending');
    await expect(
      social.listConnections(ana.supabaseId, ben.id, 'followers'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const requests = await social.getFollowRequests(ben.supabaseId);
    expect(requests.map((r) => r.user.id)).toEqual([ana.id]);

    await social.acceptFollowRequest(ben.supabaseId, ana.id);
    expect(await social.getFeed(ana.supabaseId)).toHaveLength(1);
    const after = await social.getProfile(ana.supabaseId, ben.id, 0);
    expect(after.canView).toBe(true);
    expect(after.week?.workouts).toBe(1);
    expect(after._count.followers).toBe(1);
  });

  it('follows a public account straight away', async () => {
    const ana = await db.user();
    const pub = await db.user({ isPrivate: false });
    await workout(pub.id);
    expect(await social.follow(ana.supabaseId, pub.id)).toEqual({
      status: 'accepted',
    });
    expect(await social.getFeed(ana.supabaseId)).toHaveLength(1);
    // Public profiles are visible without following
    const stranger = await db.user();
    expect(
      (await social.getProfile(stranger.supabaseId, pub.id, 0)).canView,
    ).toBe(true);
  });

  it('leaves pending requests out of counts, lists and the leaderboard', async () => {
    const ana = await db.user();
    const ben = await db.user();
    await workout(ben.id);
    await social.follow(ana.supabaseId, ben.id);

    const board = await social.getWeeklyLeaderboard(ana.supabaseId, 0);
    expect(board.map((e) => e.user.id)).toEqual([ana.id]);
    expect(
      (await social.getProfile(ben.supabaseId, 'me', 0))._count.followers,
    ).toBe(0);
    expect(
      await social.listConnections(ben.supabaseId, 'me', 'followers'),
    ).toEqual([]);
  });

  it('declines, withdraws and removes followers', async () => {
    const ana = await db.user();
    const ben = await db.user();
    await social.follow(ana.supabaseId, ben.id);
    await social.declineFollowRequest(ben.supabaseId, ana.id);
    expect(await social.getFollowRequests(ben.supabaseId)).toEqual([]);

    await social.follow(ana.supabaseId, ben.id);
    await social.unfollow(ana.supabaseId, ben.id);
    expect(await social.getFollowRequests(ben.supabaseId)).toEqual([]);

    await social.follow(ana.supabaseId, ben.id);
    await social.acceptFollowRequest(ben.supabaseId, ana.id);
    await social.removeFollower(ben.supabaseId, ana.id);
    expect((await privacy.relationship(ana.id, ben.id)).following).toBe('none');
    await expect(
      social.acceptFollowRequest(ben.supabaseId, ana.id),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('blocking removes follows both ways and hides the two from each other', async () => {
    const ana = await db.user({ displayName: 'Blockana' });
    const ben = await db.user({ displayName: 'Blockben', isPrivate: false });
    await social.follow(ana.supabaseId, ben.id);
    await social.follow(ben.supabaseId, ana.id);
    await social.acceptFollowRequest(ana.supabaseId, ben.id);

    await social.block(ben.supabaseId, ana.id);

    expect((await privacy.relationship(ana.id, ben.id)).following).toBe('none');
    expect((await privacy.relationship(ben.id, ana.id)).following).toBe('none');
    expect((await privacy.relationship(ben.id, ana.id)).blocked).toBe(true);
    // The blocked user can't find, view or follow the blocker
    expect(
      (await social.searchUsers(ana.supabaseId, 'blockben')).map((u) => u.id),
    ).toEqual([]);
    await expect(
      social.getProfile(ana.supabaseId, ben.id, 0),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(social.follow(ana.supabaseId, ben.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    // The blocker still sees the profile, marked as blocked
    const view = await social.getProfile(ben.supabaseId, ana.id, 0);
    expect(view.relationship?.blocked).toBe(true);
    expect(view.canView).toBe(false);
    expect(
      (await social.getBlocked(ben.supabaseId)).map((b) => b.user.id),
    ).toEqual([ana.id]);

    await social.unblock(ben.supabaseId, ana.id);
    expect(
      (await social.searchUsers(ana.supabaseId, 'blockben')).map((u) => u.id),
    ).toEqual([ben.id]);
  });

  it('search ranks username prefix matches first and reports relationships', async () => {
    const ana = await db.user();
    const zed = await db.user({ displayName: 'Searchzed' });
    await db.prisma.user.update({
      where: { id: zed.id },
      data: { displayName: 'Zed Searcher' },
    });
    await social.follow(ana.supabaseId, zed.id);

    const results = await social.searchUsers(ana.supabaseId, '@t_searchzed');
    expect(results[0].id).toBe(zed.id);
    expect(results[0].relationship.following).toBe('pending');
    expect(await social.searchUsers(ana.supabaseId, 'a')).toEqual([]);
  });

  it('sends follow alerts and tidies them up when requests are answered', async () => {
    const ana = await db.user({ displayName: 'Alana' });
    const ben = await db.user({ displayName: 'Bento' });
    const pub = await db.user({ displayName: 'Pubby', isPrivate: false });
    await db.prisma.pushDevice.create({
      data: {
        userId: ben.id,
        token: `ExponentPushToken[${ben.id}]`,
        platform: 'ios',
      },
    });

    await social.follow(ana.supabaseId, ben.id);
    await settle();
    const [request] = await inbox(ben.id);
    expect(request.type).toBe('follow_request');
    expect(request.body).toBe('Alana wants to follow you');
    expect(db.push.sent.at(-1)).toMatchObject({
      to: `ExponentPushToken[${ben.id}]`,
      body: 'Alana wants to follow you',
      badge: 1,
      data: { type: 'follow_request', userId: ana.id },
    });

    // Withdrawing removes the request from their inbox
    await social.unfollow(ana.supabaseId, ben.id);
    expect(await inbox(ben.id)).toHaveLength(0);

    await social.follow(ana.supabaseId, ben.id);
    await settle();
    await social.acceptFollowRequest(ben.supabaseId, ana.id);
    await settle();
    expect(await inbox(ben.id)).toHaveLength(0);
    expect((await inbox(ana.id)).map((n) => n.type)).toEqual([
      'follow_accepted',
    ]);

    // Public follow: one alert, not repeated on unfollow + follow
    await social.follow(ana.supabaseId, pub.id);
    await social.unfollow(ana.supabaseId, pub.id);
    await social.follow(ana.supabaseId, pub.id);
    await settle();
    expect((await inbox(pub.id)).map((n) => n.type)).toEqual(['follow']);
  });

  it('keeps social alerts in the inbox but skips the push when turned off', async () => {
    const ana = await db.user();
    const ben = await db.user({ isPrivate: false });
    await db.prisma.user.update({
      where: { id: ben.id },
      data: { notifSocial: false },
    });
    const token = `ExponentPushToken[quiet-${ben.id}]`;
    await db.prisma.pushDevice.create({
      data: { userId: ben.id, token, platform: 'android' },
    });

    await social.follow(ana.supabaseId, ben.id);
    await settle();
    expect(await inbox(ben.id)).toHaveLength(1);
    expect(db.push.sent.some((m) => m.to === token)).toBe(false);
  });

  it('forgets devices Expo reports as unregistered', async () => {
    const ana = await db.user();
    const ben = await db.user({ isPrivate: false });
    const token = `ExponentPushToken[dead-${ben.id}]`;
    await db.prisma.pushDevice.create({
      data: { userId: ben.id, token, platform: 'ios' },
    });
    db.push.dead.add(token);

    await social.follow(ana.supabaseId, ben.id);
    await settle();
    expect(await db.prisma.pushDevice.count({ where: { token } })).toBe(0);
  });

  it('blocking clears alerts between the two', async () => {
    const ana = await db.user();
    const ben = await db.user();
    await social.follow(ana.supabaseId, ben.id);
    await settle();
    await social.block(ben.supabaseId, ana.id);
    expect(await inbox(ben.id)).toHaveLength(0);
  });

  it('pages the feed without skipping or repeating items that share a time', async () => {
    const viewer = await db.user();
    const author = await db.user({ isPrivate: false });
    await social.follow(viewer.supabaseId, author.id);
    const at = new Date(Date.now() - 3_600_000);
    const habit = await db.prisma.habit.create({
      data: { userId: author.id, name: 'Read' },
    });
    for (let i = 0; i < 8; i++) {
      await db.prisma.activityLog.create({
        data: {
          userId: author.id,
          activityType: 'yoga',
          durationMin: 10,
          loggedAt: at,
        },
      });
      await db.prisma.foodLog.create({
        data: {
          userId: author.id,
          name: `Snack ${i}`,
          mealType: 'snack',
          calories: 100,
          loggedAt: at,
        },
      });
    }
    for (let i = 0; i < 4; i++) {
      await db.prisma.habitLog.create({
        data: {
          habitId: habit.id,
          userId: author.id,
          loggedAt: new Date(Date.UTC(2026, 0, 1 + i)),
          createdAt: at,
        },
      });
    }
    // Future-dated rows never show
    await db.prisma.foodLog.create({
      data: {
        userId: author.id,
        name: 'Tomorrow',
        mealType: 'snack',
        calories: 1,
        loggedAt: new Date(Date.now() + 86_400_000),
      },
    });

    const seen: string[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 10; page++) {
      const items = await social.getFeed(viewer.supabaseId, cursor, 7);
      if (items.length === 0) break;
      seen.push(...items.map((i) => `${i.type}:${i.id}`));
      cursor = items[items.length - 1].cursor;
    }
    expect(seen).toHaveLength(20);
    expect(new Set(seen).size).toBe(20);
  });

  it('ranks the weekly leaderboard by active minutes, counting only this week so far', async () => {
    const me = await db.user();
    const fast = await db.user({ isPrivate: false });
    const slow = await db.user({ isPrivate: false });
    const stranger = await db.user({ isPrivate: false });
    await social.follow(me.supabaseId, fast.id);
    await social.follow(me.supabaseId, slow.id);
    const now = Date.now();
    await db.prisma.activityLog.createMany({
      data: [
        {
          userId: fast.id,
          activityType: 'running',
          durationMin: 50,
          steps: 6000,
          loggedAt: new Date(now - 60_000),
        },
        {
          userId: slow.id,
          activityType: 'walking',
          durationMin: 20,
          loggedAt: new Date(now - 60_000),
        },
        {
          userId: me.id,
          activityType: 'yoga',
          durationMin: 30,
          loggedAt: new Date(now - 60_000),
        },
        // Not counted: future, last month, and someone I don't follow
        {
          userId: slow.id,
          activityType: 'walking',
          durationMin: 500,
          loggedAt: new Date(now + 3_600_000),
        },
        {
          userId: slow.id,
          activityType: 'walking',
          durationMin: 500,
          loggedAt: new Date(now - 30 * 86_400_000),
        },
        {
          userId: stranger.id,
          activityType: 'running',
          durationMin: 999,
          loggedAt: new Date(now - 60_000),
        },
      ],
    });
    const board = await social.getWeeklyLeaderboard(me.supabaseId, 0);
    expect(board.map((e) => [e.user.id, e.activeMinutes, e.isMe])).toEqual([
      [fast.id, 50, false],
      [me.id, 30, true],
      [slow.id, 20, false],
    ]);
    expect(board[0].steps).toBe(6000);
  });
});
