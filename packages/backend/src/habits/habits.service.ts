import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { addDays, dateMarker, localToday } from '../common/day';
import { PRESET_HABITS, FREE_TIER_HABIT_LIMIT } from './habits.constants';
import type { CreateHabitDto, UpdateHabitDto } from './habits.dto';

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
    if (activeCount >= FREE_TIER_HABIT_LIMIT) {
      throw new BadRequestException(
        `Free tier supports up to ${FREE_TIER_HABIT_LIMIT} habits.`,
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

  async logHabit(supabaseId: string, habitId: string, offset: number) {
    const { id: userId } = await this.resolveUser(supabaseId);
    const habit = await this.prisma.habit.findUnique({
      where: { id: habitId },
    });
    if (!habit || habit.userId !== userId) {
      throw new NotFoundException('Habit not found');
    }

    // One row per local calendar day, so the @@unique constraint dedupes check-ins
    const today = dateMarker(localToday(offset));

    return this.prisma.habitLog.upsert({
      where: {
        habitId_userId_loggedAt: { habitId, userId, loggedAt: today },
      },
      update: { completed: true },
      create: { habitId, userId, completed: true, loggedAt: today },
    });
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

    // Fetch last 37 days of logs (30 for grid + 7 buffer for grace calc)
    const today = localToday(offset);
    const since = dateMarker(addDays(today, -37));

    const logs = await this.prisma.habitLog.findMany({
      where: { habitId, userId, loggedAt: { gte: since }, completed: true },
      select: { loggedAt: true },
      orderBy: { loggedAt: 'desc' },
    });

    const completedDates = new Set(
      logs.map((l) => l.loggedAt.toISOString().split('T')[0]),
    );

    const streakCount = this.calculateStreak(completedDates, today);
    const grid = this.build30DayGrid(completedDates, today);

    return { habit, streakCount, grid };
  }

  /**
   * Consecutive completed days ending today or yesterday. One missed day is
   * forgiven once, as long as the day before it was completed.
   */
  private calculateStreak(completedDates: Set<string>, today: string): number {
    // Allow streak to start from today OR yesterday
    let cursor = completedDates.has(today) ? today : addDays(today, -1);
    if (!completedDates.has(cursor)) return 0;

    let streak = 0;
    let graceUsed = false;

    while (true) {
      if (completedDates.has(cursor)) {
        streak++;
        cursor = addDays(cursor, -1);
      } else if (!graceUsed && completedDates.has(addDays(cursor, -1))) {
        graceUsed = true;
        cursor = addDays(cursor, -1);
      } else {
        break;
      }
    }

    return streak;
  }

  /** Build last 30 days as [{date, completed}] ordered oldest → newest */
  private build30DayGrid(
    completedDates: Set<string>,
    today: string,
  ): { date: string; completed: boolean }[] {
    return Array.from({ length: 30 }, (_, i) => {
      const date = addDays(today, i - 29);
      return { date, completed: completedDates.has(date) };
    });
  }

  getPresets() {
    return Object.entries(PRESET_HABITS).map(([key, val]) => ({
      key,
      ...val,
    }));
  }
}
