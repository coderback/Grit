import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { dateMarker, localToday } from '../common/day';
import { PRESET_HABITS, MAX_ACTIVE_HABITS } from './habits.constants';
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

  getPresets() {
    return Object.entries(PRESET_HABITS).map(([key, val]) => ({
      key,
      ...val,
    }));
  }
}
