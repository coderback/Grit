import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// The 20 activity types supported for manual logging
export const ACTIVITY_TYPES = [
  'running', 'cycling', 'walking', 'swimming', 'strength_training',
  'yoga', 'hiit', 'rowing', 'elliptical', 'stair_climbing',
  'basketball', 'tennis', 'soccer', 'dancing', 'hiking',
  'jump_rope', 'pilates', 'boxing', 'rock_climbing', 'other',
] as const;

// Rough MET-based calorie estimate: MET * weight_kg * duration_hours
// Using a fixed 70 kg estimate when user weight is unavailable
const MET: Record<string, number> = {
  running: 9.8, cycling: 7.5, walking: 3.5, swimming: 8.0,
  strength_training: 5.0, yoga: 2.5, hiit: 8.0, rowing: 7.0,
  elliptical: 5.0, stair_climbing: 8.0, basketball: 6.5, tennis: 7.0,
  soccer: 7.0, dancing: 4.5, hiking: 6.0, jump_rope: 11.0,
  pilates: 3.0, boxing: 7.8, rock_climbing: 8.0, other: 5.0,
};

@Injectable()
export class ActivityService {
  constructor(private prisma: PrismaService) {}

  private async resolveUser(supabaseId: string) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId },
      select: { id: true, weightKg: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async logActivity(
    supabaseId: string,
    dto: {
      activityType: string;
      durationMin: number;
      caloriesBurned?: number;
      steps?: number;
      source?: string;
      loggedAt?: string;
    },
  ) {
    const user = await this.resolveUser(supabaseId);

    // Auto-estimate calories if not provided
    const weightKg = user.weightKg ?? 70;
    const met = MET[dto.activityType] ?? 5.0;
    const estimatedCalories =
      dto.caloriesBurned ?? Math.round(met * weightKg * (dto.durationMin / 60));

    return this.prisma.activityLog.create({
      data: {
        userId: user.id,
        activityType: dto.activityType,
        durationMin: dto.durationMin,
        caloriesBurned: estimatedCalories,
        steps: dto.steps,
        source: dto.source ?? 'manual',
        loggedAt: dto.loggedAt ? new Date(dto.loggedAt) : new Date(),
      },
    });
  }

  async getActivityLogsForDate(supabaseId: string, date: string) {
    const { id: userId } = await this.resolveUser(supabaseId);
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    return this.prisma.activityLog.findMany({
      where: { userId, loggedAt: { gte: start, lte: end } },
      orderBy: { loggedAt: 'asc' },
    });
  }

  async getWeeklySummary(supabaseId: string) {
    const { id: userId } = await this.resolveUser(supabaseId);

    // Find the most recent Monday
    const now = new Date();
    const day = now.getDay(); // 0=Sun
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((day + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const logs = await this.prisma.activityLog.findMany({
      where: { userId, loggedAt: { gte: monday, lte: sunday } },
      orderBy: { loggedAt: 'asc' },
    });

    // Build Mon–Sun buckets
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d.toISOString().split('T')[0];
    });

    const byDay = days.map((date) => {
      const dayLogs = logs.filter(
        (l) => l.loggedAt.toISOString().split('T')[0] === date,
      );
      return {
        date,
        activeMinutes: dayLogs.reduce((s, l) => s + l.durationMin, 0),
        caloriesBurned: dayLogs.reduce((s, l) => s + (l.caloriesBurned ?? 0), 0),
        steps: dayLogs.reduce((s, l) => s + (l.steps ?? 0), 0),
      };
    });

    return {
      weekStart: monday.toISOString().split('T')[0],
      weekEnd: sunday.toISOString().split('T')[0],
      days: byDay,
      totals: {
        activeMinutes: byDay.reduce((s, d) => s + d.activeMinutes, 0),
        caloriesBurned: byDay.reduce((s, d) => s + d.caloriesBurned, 0),
        steps: byDay.reduce((s, d) => s + d.steps, 0),
      },
    };
  }

  async giveKudos(actorSupabaseId: string, logId: string) {
    // Idempotent — just increments. In Phase D we'll add a Kudos table for per-user dedup.
    await this.resolveUser(actorSupabaseId); // ensure actor exists

    const log = await this.prisma.activityLog.findUnique({ where: { id: logId } });
    if (!log) throw new NotFoundException('Activity log not found');

    return this.prisma.activityLog.update({
      where: { id: logId },
      data: { kudosCount: { increment: 1 } },
    });
  }

  getActivityTypes() {
    return ACTIVITY_TYPES;
  }
}
