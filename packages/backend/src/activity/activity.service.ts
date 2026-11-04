import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  addDays,
  dayRange,
  localDateOf,
  localToday,
  weekStart,
} from '../common/day';
import { ACTIVITY_TYPES, MET } from './activity.constants';
import type {
  CreateActivityLogDto,
  UpdateActivityLogDto,
} from './activity.dto';

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

  /** MET × body weight × hours, using 70 kg when the weight isn't set. */
  private estimateCalories(
    activityType: string,
    durationMin: number,
    weightKg: number | null,
  ) {
    const met = MET[activityType] ?? 5.0;
    return Math.round(met * (weightKg ?? 70) * (durationMin / 60));
  }

  async logActivity(supabaseId: string, dto: CreateActivityLogDto) {
    const user = await this.resolveUser(supabaseId);

    // Auto-estimate calories if not provided
    const estimatedCalories =
      dto.caloriesBurned ??
      this.estimateCalories(dto.activityType, dto.durationMin, user.weightKg);

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

  async updateActivityLog(
    supabaseId: string,
    id: string,
    dto: UpdateActivityLogDto,
  ) {
    const user = await this.resolveUser(supabaseId);
    const log = await this.prisma.activityLog.findFirst({
      where: { id, userId: user.id },
    });
    if (!log) throw new NotFoundException('Activity log not found');

    const activityType = dto.activityType ?? log.activityType;
    const durationMin = dto.durationMin ?? log.durationMin;
    const reestimate =
      dto.caloriesBurned === undefined &&
      (activityType !== log.activityType || durationMin !== log.durationMin);

    return this.prisma.activityLog.update({
      where: { id },
      data: {
        activityType,
        durationMin,
        steps: dto.steps,
        loggedAt: dto.loggedAt ? new Date(dto.loggedAt) : undefined,
        caloriesBurned: reestimate
          ? this.estimateCalories(activityType, durationMin, user.weightKg)
          : dto.caloriesBurned,
      },
    });
  }

  async deleteActivityLog(supabaseId: string, id: string) {
    const user = await this.resolveUser(supabaseId);
    const { count } = await this.prisma.activityLog.deleteMany({
      where: { id, userId: user.id },
    });
    if (!count) throw new NotFoundException('Activity log not found');
    return { ok: true };
  }

  async getActivityLogsForDate(
    supabaseId: string,
    date: string,
    offset: number,
  ) {
    const { id: userId } = await this.resolveUser(supabaseId);
    const { start, end } = dayRange(date, offset);

    return this.prisma.activityLog.findMany({
      where: { userId, loggedAt: { gte: start, lt: end } },
      orderBy: { loggedAt: 'asc' },
    });
  }

  /** The Mon–Sun week containing `date` (default: this week), with its workouts. */
  async getWeeklySummary(supabaseId: string, offset: number, date?: string) {
    const { id: userId } = await this.resolveUser(supabaseId);

    const monday = weekStart(date ?? localToday(offset));
    const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

    const logs = await this.prisma.activityLog.findMany({
      where: {
        userId,
        loggedAt: {
          gte: dayRange(monday, offset).start,
          lt: dayRange(days[6], offset).end,
        },
      },
      orderBy: { loggedAt: 'asc' },
    });

    const byDay = days.map((date) => {
      const dayLogs = logs.filter(
        (l) => localDateOf(l.loggedAt, offset) === date,
      );
      return {
        date,
        activeMinutes: dayLogs.reduce((s, l) => s + l.durationMin, 0),
        caloriesBurned: dayLogs.reduce(
          (s, l) => s + (l.caloriesBurned ?? 0),
          0,
        ),
        steps: dayLogs.reduce((s, l) => s + (l.steps ?? 0), 0),
      };
    });

    return {
      weekStart: monday,
      weekEnd: days[6],
      days: byDay,
      logs,
      totals: {
        activeMinutes: byDay.reduce((s, d) => s + d.activeMinutes, 0),
        caloriesBurned: byDay.reduce((s, d) => s + d.caloriesBurned, 0),
        steps: byDay.reduce((s, d) => s + d.steps, 0),
      },
    };
  }

  /** One kudos per user per log; repeat requests are a no-op. */
  async giveKudos(actorSupabaseId: string, logId: string) {
    const actor = await this.resolveUser(actorSupabaseId);

    const log = await this.prisma.activityLog.findUnique({
      where: { id: logId },
    });
    if (!log) throw new NotFoundException('Activity log not found');
    if (log.userId === actor.id) {
      throw new BadRequestException(
        "You can't give kudos to your own activity",
      );
    }

    try {
      const [, updated] = await this.prisma.$transaction([
        this.prisma.kudos.create({
          data: { activityLogId: logId, userId: actor.id },
        }),
        this.prisma.activityLog.update({
          where: { id: logId },
          data: { kudosCount: { increment: 1 } },
        }),
      ]);
      return updated;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        return log; // already given
      }
      throw err;
    }
  }

  getActivityTypes() {
    return ACTIVITY_TYPES;
  }
}
