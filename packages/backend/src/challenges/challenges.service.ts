import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { dayRange, localToday } from '../common/day';
import type { CreateChallengeDto } from './challenges.dto';

const MAX_PARTICIPANTS = 8;
const participantUser = {
  select: { id: true, displayName: true, avatarUrl: true, username: true },
};

@Injectable()
export class ChallengesService {
  constructor(private prisma: PrismaService) {}

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

    // Runs from the start of the creator's local today for durationDays days
    const startDate = dayRange(localToday(offset), offset).start;
    const endDate = new Date(
      startDate.getTime() + dto.durationDays * 86_400_000,
    );

    return this.prisma.challenge.create({
      data: {
        title: dto.title,
        type: 'group_steps',
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

  async getUserChallenges(supabaseId: string) {
    const user = await this.resolveUser(supabaseId);
    return this.prisma.challenge.findMany({
      where: { participants: { some: { userId: user.id } } },
      include: {
        participants: {
          include: { user: participantUser },
          orderBy: { currentValue: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Only participants can see a challenge (and its invite code). */
  async getChallenge(supabaseId: string, challengeId: string) {
    const user = await this.resolveUser(supabaseId);
    const challenge = await this.prisma.challenge.findUnique({
      where: { id: challengeId },
      include: {
        participants: {
          include: { user: participantUser },
          orderBy: { currentValue: 'desc' },
        },
      },
    });
    if (!challenge || !challenge.participants.some((p) => p.userId === user.id)) {
      throw new NotFoundException('Challenge not found');
    }

    const totalProgress = challenge.participants.reduce(
      (s, p) => s + p.currentValue, 0,
    );

    return { ...challenge, totalProgress };
  }

  async joinByInviteCode(supabaseId: string, inviteCode: string) {
    const user = await this.resolveUser(supabaseId);
    const challenge = await this.prisma.challenge.findUnique({
      where: { inviteCode },
      include: { _count: { select: { participants: true } } },
    });
    if (!challenge) throw new NotFoundException('Challenge not found');
    if (challenge.isComplete) throw new BadRequestException('Challenge is already complete');
    if (challenge.endDate <= new Date()) {
      throw new BadRequestException('Challenge has ended');
    }
    if (challenge._count.participants >= MAX_PARTICIPANTS) {
      throw new BadRequestException(
        `Challenge is full (max ${MAX_PARTICIPANTS} participants)`,
      );
    }

    return this.prisma.challengeParticipant.upsert({
      where: { challengeId_userId: { challengeId: challenge.id, userId: user.id } },
      update: {},
      create: { challengeId: challenge.id, userId: user.id },
    });
  }

  async updateProgress(supabaseId: string, challengeId: string, steps: number) {
    const user = await this.resolveUser(supabaseId);
    const participant = await this.prisma.challengeParticipant.findUnique({
      where: { challengeId_userId: { challengeId, userId: user.id } },
    });
    if (!participant) throw new NotFoundException('Not a participant of this challenge');

    const current = await this.prisma.challenge.findUnique({
      where: { id: challengeId },
      select: { endDate: true },
    });
    if (current && current.endDate <= new Date()) {
      throw new BadRequestException('Challenge has ended');
    }

    const updated = await this.prisma.challengeParticipant.update({
      where: { challengeId_userId: { challengeId, userId: user.id } },
      data: { currentValue: steps },
    });

    // Check if challenge goal is met — mark complete
    const challenge = await this.prisma.challenge.findUnique({
      where: { id: challengeId },
      include: { participants: { select: { currentValue: true } } },
    });
    if (challenge) {
      const total = challenge.participants.reduce((s, p) => s + p.currentValue, 0);
      if (!challenge.isComplete && total >= challenge.goalValue) {
        await this.prisma.challenge.update({
          where: { id: challengeId },
          data: { isComplete: true },
        });
      }
    }

    return updated;
  }
}
