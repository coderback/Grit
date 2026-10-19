import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { addDays, dateMarker, localToday } from '../common/day';
import {
  BACKFILL_DAYS,
  MAX_ACTIVE_HABITS,
  PRESET_HABITS,
} from './habits.constants';
import type { CreateHabitDto, UpdateHabitDto } from './habits.dto';
import { build30DayGrid, calculateStreak } from './habits.streak';

@Injectable()
export class HabitsService {
  constructor(private prisma: PrismaService) {}

  private async resolveUser(supabaseId: string) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async getHabits(supabaseId: string) {
    const { id: userId } = await this.resolveUser(supabaseId);
    return this.prisma.habit.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createHabit(supabaseId: string, dto: CreateHabitDto) {
    const { id: userId } = await this.resolveUser(supabaseId);

    const activeCount = await this.prisma.habit.count({
      where: { userId, isActive: true },
    });
    if (activeCount >= MAX_ACTIVE_HABITS) {
      throw new BadRequestException(
        `You can track up to ${MAX_ACTIVE_HABITS} habits at a time.`,
      );
    }

    let name = dto.name;
    let emoji = dto.emoji ?? '✅';
    let isPreset = false;

    if (dto.presetKey) {
      const preset = PRESET_HABITS[dto.presetKey];
      if (!preset) throw new BadRequestException('Unknown preset key');
      name = preset.name;
      emoji = preset.emoji;
      isPreset = true;
    }

    if (!name) throw new BadRequestException('name or presetKey is required');

    return this.prisma.habit.create({
      data: { userId, name, emoji, isPreset, presetKey: dto.presetKey },
    });
  }

  async updateHabit(supabaseId: string, habitId: string, dto: UpdateHabitDto) {
    const { id: userId } = await this.resolveUser(supabaseId);
    const habit = await this.prisma.habit.findUnique({
      where: { id: habitId },
    });
    if (!habit || habit.userId !== userId) {
      throw new NotFoundException('Habit not found');
    }
    return this.prisma.habit.update({
      where: { id: habitId },
      data: { name: dto.name, emoji: dto.emoji },
    });
  }

  async deleteHabit(supabaseId: string, habitId: string) {
    const { id: userId } = await this.resolveUser(supabaseId);
    const habit = await this.prisma.habit.findUnique({
      where: { id: habitId },
    });
    if (!habit || habit.userId !== userId) {
      throw new NotFoundException('Habit not found');
    }
    return this.prisma.habit.update({
      where: { id: habitId },
      data: { isActive: false },
    });
  }

  // ── Daily check-in ────────────────────────────────────────────────────────

  /** Check-ins can be back-filled within the 30 days the streak grid shows. */
  private checkInDay(offset: number, date?: string): Date {
    const today = localToday(offset);
    const day = date ?? today;
    if (day > today) {
      throw new BadRequestException("You can't check in for a future day");
    }
    if (day < addDays(today, -(BACKFILL_DAYS - 1))) {
      throw new BadRequestException(
        `Check-ins can be added up to ${BACKFILL_DAYS} days back`,
      );
    }
    return dateMarker(day);
  }

  private async ownHabit(userId: string, habitId: string) {
    const habit = await this.prisma.habit.findFirst({
      where: { id: habitId, userId },
    });
    if (!habit) throw new NotFoundException('Habit not found');
    return habit;
  }

  async logHabit(
    supabaseId: string,
    habitId: string,
    offset: number,
    date?: string,
  ) {
    const { id: userId } = await this.resolveUser(supabaseId);
    await this.ownHabit(userId, habitId);

    // One row per local calendar day, so the @@unique constraint dedupes check-ins
    const loggedAt = this.checkInDay(offset, date);

    return this.prisma.habitLog.upsert({
      where: { habitId_userId_loggedAt: { habitId, userId, loggedAt } },
      update: { completed: true },
      create: { habitId, userId, completed: true, loggedAt },
    });
  }

  /** Removes a day's check-in (undo, or correcting the past). */
  async unlogHabit(
    supabaseId: string,
    habitId: string,
    offset: number,
    date?: string,
  ) {
    const { id: userId } = await this.resolveUser(supabaseId);
    await this.ownHabit(userId, habitId);
    await this.prisma.habitLog.deleteMany({
      where: { habitId, userId, loggedAt: this.checkInDay(offset, date) },
    });
    return { ok: true };
  }

  // ── Streak + 30-day grid ──────────────────────────────────────────────────

  async getStreak(supabaseId: string, habitId: string, offset: number) {
    const { id: userId } = await this.resolveUser(supabaseId);
    const habit = await this.prisma.habit.findUnique({
      where: { id: habitId },
    });
    if (!habit || habit.userId !== userId) {
      throw new NotFoundException('Habit not found');
    }

    // The whole history, not just the grid's 30 days, so long streaks keep
    // counting. Only the dates are loaded, at most one row per day.
    const today = localToday(offset);
    const logs = await this.prisma.habitLog.findMany({
      where: {
        habitId,
        userId,
        completed: true,
        loggedAt: { lte: dateMarker(today) },
      },
      select: { loggedAt: true },
    });

    const completedDates = new Set(
      logs.map((l) => l.loggedAt.toISOString().split('T')[0]),
    );

    const streakCount = calculateStreak(completedDates, today);
    const grid = build30DayGrid(completedDates, today);

    return { habit, streakCount, grid };
  }

  /**
   * Streak, 30-day grid and today's state for every active habit, in two
   * queries. Replaces one /streak request per habit.
   */
  async getAllStreaks(supabaseId: string, offset: number) {
    const { id: userId } = await this.resolveUser(supabaseId);
    const today = localToday(offset);

    const habits = await this.prisma.habit.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    const logs = await this.prisma.habitLog.findMany({
      where: {
        userId,
        completed: true,
        habitId: { in: habits.map((h) => h.id) },
        loggedAt: { lte: dateMarker(today) },
      },
      select: { habitId: true, loggedAt: true },
    });

    const datesByHabit = new Map<string, Set<string>>();
    for (const log of logs) {
      const dates = datesByHabit.get(log.habitId) ?? new Set<string>();
      dates.add(log.loggedAt.toISOString().slice(0, 10));
      datesByHabit.set(log.habitId, dates);
    }

    const streaks = habits.map(({ id }) => {
      const dates = datesByHabit.get(id) ?? new Set<string>();
      return {
        habitId: id,
        streakCount: calculateStreak(dates, today),
        completedToday: dates.has(today),
        grid: build30DayGrid(dates, today),
      };
    });

    return {
      streaks,
      todayDone: streaks.filter((s) => s.completedToday).length,
      maxStreak: Math.max(0, ...streaks.map((s) => s.streakCount)),
    };
  }

  getPresets() {
    return Object.entries(PRESET_HABITS).map(([key, val]) => ({
      key,
      ...val,
    }));
  }
}
