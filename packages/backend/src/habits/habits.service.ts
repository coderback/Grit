import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PRESET_HABITS, FREE_TIER_HABIT_LIMIT } from './habits.constants';

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

  async createHabit(
    supabaseId: string,
    dto: { name?: string; emoji?: string; presetKey?: string },
  ) {
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

  async updateHabit(
    supabaseId: string,
    habitId: string,
    dto: { name?: string; emoji?: string },
  ) {
    const { id: userId } = await this.resolveUser(supabaseId);
    const habit = await this.prisma.habit.findUnique({ where: { id: habitId } });
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
    const habit = await this.prisma.habit.findUnique({ where: { id: habitId } });
    if (!habit || habit.userId !== userId) {
      throw new NotFoundException('Habit not found');
    }
    return this.prisma.habit.update({
      where: { id: habitId },
      data: { isActive: false },
    });
  }

  // ── Daily check-in ────────────────────────────────────────────────────────

  async logHabit(supabaseId: string, habitId: string) {
    const { id: userId } = await this.resolveUser(supabaseId);
    const habit = await this.prisma.habit.findUnique({ where: { id: habitId } });
    if (!habit || habit.userId !== userId) {
      throw new NotFoundException('Habit not found');
    }

    // Normalise to start-of-day so the @@unique constraint works correctly
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.prisma.habitLog.upsert({
      where: {
        habitId_userId_loggedAt: { habitId, userId, loggedAt: today },
      },
      update: { completed: true },
      create: { habitId, userId, completed: true, loggedAt: today },
    });
  }

  // ── Streak + 30-day grid ──────────────────────────────────────────────────

  async getStreak(supabaseId: string, habitId: string) {
    const { id: userId } = await this.resolveUser(supabaseId);
    const habit = await this.prisma.habit.findUnique({ where: { id: habitId } });
    if (!habit || habit.userId !== userId) {
      throw new NotFoundException('Habit not found');
    }

    // Fetch last 37 days of logs (30 for grid + 7 buffer for grace calc)
    const since = new Date();
    since.setDate(since.getDate() - 37);
    since.setHours(0, 0, 0, 0);

    const logs = await this.prisma.habitLog.findMany({
      where: { habitId, userId, loggedAt: { gte: since }, completed: true },
      select: { loggedAt: true },
      orderBy: { loggedAt: 'desc' },
    });

    const completedDates = new Set(
      logs.map((l) => l.loggedAt.toISOString().split('T')[0]),
    );

    const streakCount = this.calculateStreak(completedDates);
    const grid = this.build30DayGrid(completedDates);

    return { habit, streakCount, grid };
  }

  /**
   * Streak calculation with 1-day grace period:
   * Allow one missed day if the 6 days before it were all complete.
   */
  private calculateStreak(completedDates: Set<string>): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Allow streak to start from today OR yesterday
    const startOffset = completedDates.has(this.dateStr(today)) ? 0 : 1;
    const start = new Date(today);
    start.setDate(today.getDate() - startOffset);

    if (!completedDates.has(this.dateStr(start))) return 0;

    let streak = 0;
    let graceUsed = false;
    const cursor = new Date(start);

    while (true) {
      const ds = this.dateStr(cursor);
      if (completedDates.has(ds)) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else if (!graceUsed) {
        // Grace: peek at the day before — if completed, use grace
        const prev = new Date(cursor);
        prev.setDate(cursor.getDate() - 1);
        if (completedDates.has(this.dateStr(prev))) {
          graceUsed = true;
          cursor.setDate(cursor.getDate() - 1);
        } else {
          break;
        }
      } else {
        break;
      }
    }

    return streak;
  }

  /** Build last 30 days as [{date, completed}] ordered oldest → newest */
  private build30DayGrid(
    completedDates: Set<string>,
  ): { date: string; completed: boolean }[] {
    const result: { date: string; completed: boolean }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const ds = this.dateStr(d);
      result.push({ date: ds, completed: completedDates.has(ds) });
    }

    return result;
  }

  private dateStr(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  getPresets() {
    return Object.entries(PRESET_HABITS).map(([key, val]) => ({
      key,
      ...val,
    }));
  }
}
