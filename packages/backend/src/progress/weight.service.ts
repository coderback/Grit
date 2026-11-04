import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { addDays, dateMarker, localToday } from '../common/day';

const BACKFILL_DAYS = 365;

@Injectable()
export class WeightService {
  constructor(private prisma: PrismaService) {}

  private async resolveUser(supabaseId: string) {
    const user = await this.prisma.user.findUnique({ where: { supabaseId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /** Keeps the profile weight equal to the most recent weigh-in. */
  private async syncProfileWeight(userId: string) {
    const latest = await this.prisma.weightLog.findFirst({
      where: { userId },
      orderBy: { day: 'desc' },
    });
    if (latest) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { weightKg: latest.weightKg },
      });
    }
  }

  /** Records a weigh-in for a day (today by default), replacing that day's. */
  async log(
    supabaseId: string,
    weightKg: number,
    offset: number,
    date?: string,
  ) {
    const user = await this.resolveUser(supabaseId);
    return this.logForUser(user.id, weightKg, offset, date);
  }

  async logForUser(
    userId: string,
    weightKg: number,
    offset: number,
    date?: string,
  ) {
    const today = localToday(offset);
    const day = date ?? today;
    if (day > today) throw new BadRequestException("Can't log a future weight");
    if (day < addDays(today, -BACKFILL_DAYS)) {
      throw new BadRequestException('Weights can be added for the past year');
    }
    const rounded = Math.round(weightKg * 100) / 100;
    const entry = await this.prisma.weightLog.upsert({
      where: { userId_day: { userId, day: dateMarker(day) } },
      update: { weightKg: rounded },
      create: { userId, day: dateMarker(day), weightKg: rounded },
    });
    await this.syncProfileWeight(userId);
    return { id: entry.id, date: day, weightKg: entry.weightKg };
  }

  async remove(supabaseId: string, id: string) {
    const user = await this.resolveUser(supabaseId);
    const { count } = await this.prisma.weightLog.deleteMany({
      where: { id, userId: user.id },
    });
    if (count === 0) throw new NotFoundException('Weight entry not found');
    await this.syncProfileWeight(user.id);
    return { ok: true };
  }

  /** Weigh-ins over the last `days`, oldest first, with progress to the goal. */
  async history(supabaseId: string, days: number, offset: number) {
    const user = await this.resolveUser(supabaseId);
    const today = localToday(offset);
    const entries = await this.prisma.weightLog.findMany({
      where: {
        userId: user.id,
        day: {
          gte: dateMarker(addDays(today, -(days - 1))),
          lte: dateMarker(today),
        },
      },
      orderBy: { day: 'asc' },
      select: { id: true, day: true, weightKg: true },
    });
    const list = entries.map((e) => ({
      id: e.id,
      date: e.day.toISOString().slice(0, 10),
      weightKg: e.weightKg,
    }));
    const first = list[0]?.weightKg ?? null;
    const latest = list.at(-1)?.weightKg ?? user.weightKg ?? null;
    return {
      entries: list,
      latest,
      change: first !== null && latest !== null ? round1(latest - first) : null,
      goalWeightKg: user.goalWeightKg,
      toGoal:
        latest !== null && user.goalWeightKg
          ? round1(user.goalWeightKg - latest)
          : null,
    };
  }
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
