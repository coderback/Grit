import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Challenge } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { dayRange, localToday } from '../common/day';
import type { CreateChallengeDto } from './challenges.dto';
import {
  GOAL_LIMITS,
  endedAlert,
  isChallengeType,
  ranks,
  scoreFor,
} from './challenge-rules';

const MAX_PARTICIPANTS = 8;
const participantUser = {
  select: { id: true, displayName: true, avatarUrl: true, username: true },
};
const withParticipants = {
  participants: {
    include: { user: participantUser },
    orderBy: [{ currentValue: 'desc' as const }, { joinedAt: 'asc' as const }],
  },
};

@Injectable()
export class ChallengesService {
  private readonly logger = new Logger(ChallengesService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  private async resolveUser(supabaseId: string) {
    const user = await this.prisma.user.findUnique({ where: { supabaseId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async createChallenge(
    supabaseId: string,
    dto: CreateChallengeDto,
    offset: number,
  ) {
    const user = await this.resolveUser(supabaseId);
    const type = dto.type && isChallengeType(dto.type) ? dto.type : 'steps';
    const { min, max } = GOAL_LIMITS[type];
    if (dto.goalValue < min || dto.goalValue > max) {
      throw new BadRequestException(
        `goalValue for a ${type.replace('_', ' ')} challenge must be between ${min} and ${max}`,
      );
    }

    // Runs from the start of the creator's local today for durationDays days
    const startDate = dayRange(localToday(offset), offset).start;
    const endDate = new Date(
      startDate.getTime() + dto.durationDays * 86_400_000,
    );

    return this.prisma.challenge.create({
      data: {
        title: dto.title,
        type,
        goalValue: dto.goalValue,
        durationDays: dto.durationDays,
        startDate,
        endDate,
        creatorId: user.id,
        // Creator auto-joins
        participants: { create: { userId: user.id } },
      },
    });
  }

  /**
   * Recomputes every participant's score from the workouts they logged
   * between the start and the end (or now), and marks the goal reached.
   * Finished challenges are left as they ended.
   */
  private async refreshProgress(challenges: Challenge[], now = new Date()) {
    for (const c of challenges) {
      if (c.endedAt) continue;
      const participants = await this.prisma.challengeParticipant.findMany({
        where: { challengeId: c.id },
        select: { userId: true, currentValue: true },
      });
      const until = c.endDate < now ? c.endDate : now;
      const sums = await this.prisma.activityLog.groupBy({
        by: ['userId'],
        where: {
          userId: { in: participants.map((p) => p.userId) },
          loggedAt: { gte: c.startDate, lt: until },
        },
        _sum: { steps: true, durationMin: true },
        _count: { _all: true },
      });
      const byUser = new Map(sums.map((s) => [s.userId, s]));

      let total = 0;
      for (const p of participants) {
        const s = byUser.get(p.userId);
        const value = scoreFor(c.type, {
          steps: s?._sum.steps ?? 0,
          minutes: s?._sum.durationMin ?? 0,
          workouts: s?._count._all ?? 0,
        });
        total += value;
        if (value !== p.currentValue) {
          await this.prisma.challengeParticipant.update({
            where: {
              challengeId_userId: { challengeId: c.id, userId: p.userId },
            },
            data: { currentValue: value },
          });
        }
      }
      // Reaching the goal is permanent, even if a workout is deleted later
      if (!c.isComplete && total >= c.goalValue) {
        await this.prisma.challenge.update({
          where: { id: c.id },
          data: { isComplete: true },
        });
      }
    }
  }

  private withTotals<T extends { participants: { currentValue: number }[] }>(
    c: T,
  ) {
    return {
      ...c,
      totalProgress: c.participants.reduce((s, p) => s + p.currentValue, 0),
    };
  }

  async getUserChallenges(supabaseId: string) {
    const user = await this.resolveUser(supabaseId);
    const where = { participants: { some: { userId: user.id } } };
    await this.refreshProgress(
      await this.prisma.challenge.findMany({
        where: { ...where, endedAt: null },
      }),
    );
    const challenges = await this.prisma.challenge.findMany({
      where,
      include: withParticipants,
      orderBy: { createdAt: 'desc' },
    });
    return challenges.map((c) => this.withTotals(c));
  }

  /** Only participants can see a challenge (and its invite code). */
  async getChallenge(supabaseId: string, challengeId: string) {
    const user = await this.resolveUser(supabaseId);
    const found = await this.prisma.challenge.findUnique({
      where: { id: challengeId },
      include: { participants: { select: { userId: true } } },
    });
    if (!found || !found.participants.some((p) => p.userId === user.id)) {
      throw new NotFoundException('Challenge not found');
    }
    await this.refreshProgress([found]);
    const challenge = await this.prisma.challenge.findUniqueOrThrow({
      where: { id: challengeId },
      include: withParticipants,
    });
    return {
      ...this.withTotals(challenge),
      isCreator: challenge.creatorId === user.id,
    };
  }

  async joinByInviteCode(supabaseId: string, inviteCode: string) {
    const user = await this.resolveUser(supabaseId);
    const challenge = await this.prisma.challenge.findUnique({
      where: { inviteCode },
      include: { _count: { select: { participants: true } } },
    });
    if (!challenge) throw new NotFoundException('Challenge not found');
    if (challenge.endedAt || challenge.endDate <= new Date()) {
      throw new BadRequestException('Challenge has ended');
    }

    const existing = await this.prisma.challengeParticipant.findUnique({
      where: {
        challengeId_userId: { challengeId: challenge.id, userId: user.id },
      },
    });
    if (existing) return existing;
    if (challenge._count.participants >= MAX_PARTICIPANTS) {
      throw new BadRequestException(
        `Challenge is full (max ${MAX_PARTICIPANTS} participants)`,
      );
    }

    const participant = await this.prisma.challengeParticipant.upsert({
      where: {
        challengeId_userId: { challengeId: challenge.id, userId: user.id },
      },
      update: {},
      create: { challengeId: challenge.id, userId: user.id },
    });
    if (challenge.creatorId !== user.id) {
      this.notifications.notifyQuietly(challenge.creatorId, {
        type: 'challenge_joined',
        actorId: user.id,
        title: 'New challenger',
        body: `${user.displayName} joined ${challenge.title}`,
        data: { challengeId: challenge.id, userId: user.id },
        dedupeKey: `challenge_joined:${challenge.id}:${user.id}`,
      });
    }
    return participant;
  }

  /** Leave a challenge. The creator deletes it instead. */
  async leave(supabaseId: string, challengeId: string) {
    const user = await this.resolveUser(supabaseId);
    const challenge = await this.prisma.challenge.findUnique({
      where: { id: challengeId },
    });
    if (!challenge) throw new NotFoundException('Challenge not found');
    if (challenge.creatorId === user.id) {
      throw new BadRequestException(
        "You created this challenge, so you can't leave it. Delete it instead.",
      );
    }
    const { count } = await this.prisma.challengeParticipant.deleteMany({
      where: { challengeId, userId: user.id },
    });
    if (count === 0) throw new NotFoundException('Challenge not found');
    return { ok: true };
  }

  /** Only the creator can delete a challenge; it's removed for everyone. */
  async remove(supabaseId: string, challengeId: string) {
    const user = await this.resolveUser(supabaseId);
    const challenge = await this.prisma.challenge.findUnique({
      where: { id: challengeId },
      include: { participants: { select: { userId: true } } },
    });
    if (
      !challenge ||
      !challenge.participants.some((p) => p.userId === user.id)
    ) {
      throw new NotFoundException('Challenge not found');
    }
    if (challenge.creatorId !== user.id) {
      throw new ForbiddenException('Only the creator can delete a challenge');
    }
    await this.prisma.challenge.delete({ where: { id: challengeId } });
    return { ok: true };
  }

  /**
   * Finalises challenges whose end date has passed: last scores, then a
   * results alert to everyone taking part. Run hourly; `endedAt` makes each
   * challenge finish once.
   */
  async finishEnded(now = new Date()): Promise<number> {
    const due = await this.prisma.challenge.findMany({
      where: { endDate: { lte: now }, endedAt: null },
    });
    let finished = 0;
    for (const c of due) {
      await this.refreshProgress([c], now);
      // Claim it, so a second server running the same job skips it
      const { count } = await this.prisma.challenge.updateMany({
        where: { id: c.id, endedAt: null },
        data: { endedAt: now },
      });
      if (count === 0) continue;
      finished++;

      const final = await this.prisma.challenge.findUniqueOrThrow({
        where: { id: c.id },
        include: withParticipants,
      });
      const values = final.participants.map((p) => p.currentValue);
      const place = ranks(values);
      const total = values.reduce((a, b) => a + b, 0);
      for (const [i, p] of final.participants.entries()) {
        await this.notifications
          .notify(p.userId, {
            type: 'challenge_ended',
            ...endedAlert({
              title: final.title,
              type: final.type,
              goalValue: final.goalValue,
              total,
              rank: place[i],
              participants: final.participants.length,
            }),
            data: { challengeId: final.id },
            dedupeKey: `challenge_ended:${final.id}`,
          })
          .catch((err: Error) =>
            this.logger.warn(`Challenge result alert failed: ${err.message}`),
          );
      }
    }
    return finished;
  }
}
