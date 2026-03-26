import {
  Injectable, NotFoundException, BadRequestException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
    dto: { title: string; goalValue: number; durationDays: number },
  ) {
    const user = await this.resolveUser(supabaseId);

    if (![3, 7, 14, 30].includes(dto.durationDays)) {
      throw new BadRequestException('Duration must be 3, 7, 14, or 30 days');
    }

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + dto.durationDays);

    const challenge = await this.prisma.challenge.create({
      data: {
        title: dto.title,
        type: 'group_steps',
        goalValue: dto.goalValue,
        durationDays: dto.durationDays,
        startDate,
        endDate,
        creatorId: user.id,
      },
    });

    // Creator auto-joins
    await this.prisma.challengeParticipant.create({
      data: { challengeId: challenge.id, userId: user.id },
    });

    return challenge;
  }

  async getUserChallenges(supabaseId: string) {
    const user = await this.resolveUser(supabaseId);
    return this.prisma.challenge.findMany({
      where: { participants: { some: { userId: user.id } } },
      include: {
        participants: {
          include: {
            user: { select: { id: true, displayName: true, avatarUrl: true, username: true } },
          },
          orderBy: { currentValue: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getChallenge(challengeId: string) {
    const challenge = await this.prisma.challenge.findUnique({
      where: { id: challengeId },
      include: {
        participants: {
          include: {
            user: { select: { id: true, displayName: true, avatarUrl: true, username: true } },
          },
          orderBy: { currentValue: 'desc' },
        },
      },
    });
    if (!challenge) throw new NotFoundException('Challenge not found');

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
    if (challenge._count.participants >= 8) {
      throw new BadRequestException('Challenge is full (max 8 participants)');
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
