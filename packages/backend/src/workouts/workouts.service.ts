import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';
import { AI_MODEL } from '../ai/azure-openai';
import { assertAiConsent } from '../common/ai-consent';
import { giveBackParse, takeParse } from '../common/parse-quota';
import {
  addDays,
  dateMarker,
  dayRange,
  localDateOf,
  localToday,
} from '../common/day';
import { metFor } from '../activity/activity.constants';
import { COMMON_EXERCISES } from '../exercises/exercise-tags';
import { AdaptiveService } from '../progress/adaptive.service';
import {
  markPrs,
  parseDetail,
  recordsOf,
  round1,
  volumeKg,
  epley,
  NO_RECORDS,
  type LoggedSet,
  type PlanTarget,
} from './strength';
import {
  NO_RECOVERY,
  PROTEIN_G_PER_KG,
  suggest,
  type PastSession,
  type Recovery,
  type Suggestion,
} from './progression';
import {
  parseSpokenSets,
  workoutInstructions,
  workoutSchema,
  type SpokenSet,
} from './say-it';
import type {
  ParseSetsDto,
  PrepareWorkoutDto,
  SaveWorkoutDto,
  UpdateWorkoutDto,
  WorkoutSetDto,
} from './workouts.dto';

const DEFAULT_TARGET: PlanTarget = { sets: 3, repsLow: 8, repsHigh: 12 };
// How many past sessions of an exercise the rules look at
const HISTORY_SESSIONS = 3;
const LB = 0.45359237;

const EXERCISE_FACTS = {
  id: true,
  name: true,
  equipment: true,
  pattern: true,
  primary: true,
  imageUrl: true,
} as const;

type SetRow = {
  exerciseId: string;
  reps: number;
  weightKg: number | null;
  durationSec: number | null;
  warmup: boolean;
};

/** The plan's training days, in order: session 1 is the first. */
export function trainingDays<T extends { rest: boolean }>(days: unknown): T[] {
  return Array.isArray(days) ? (days as T[]).filter((d) => !d.rest) : [];
}

@Injectable()
export class WorkoutsService {
  private readonly logger = new Logger(WorkoutsService.name);

  constructor(
    private prisma: PrismaService,
    private adaptive: AdaptiveService,
    private openai: OpenAI,
    @Inject(AI_MODEL) private model: string,
  ) {}

  private async resolveUser(supabaseId: string) {
    const user = await this.prisma.user.findUnique({ where: { supabaseId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async checkExercises(ids: string[]) {
    const unique = [...new Set(ids)];
    if (!unique.length) return new Map<string, { name: string }>();
    const found = await this.prisma.exercise.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true },
    });
    if (found.length !== unique.length) {
      const known = new Set(found.map((e) => e.id));
      throw new BadRequestException(
        `Unknown exercise: ${unique.find((id) => !known.has(id))}`,
      );
    }
    return new Map(found.map((e) => [e.id, e]));
  }

  /** The best each exercise had been lifted before a time. */
  private async recordsBefore(userId: string, ids: string[], before: Date) {
    const rows = await this.prisma.workoutSet.findMany({
      where: {
        userId,
        exerciseId: { in: [...new Set(ids)] },
        warmup: false,
        session: { startedAt: { lt: before } },
      },
      select: { exerciseId: true, reps: true, weightKg: true },
    });
    const by = new Map<string, LoggedSet[]>();
    for (const r of rows) {
      by.set(r.exerciseId, [...(by.get(r.exerciseId) ?? []), r]);
    }
    return new Map(
      [...by.entries()].map(([id, sets]) => [id, recordsOf(sets)] as const),
    );
  }

  private async setsWithPrs(
    userId: string,
    sets: WorkoutSetDto[],
    startedAt: Date,
  ) {
    const history = await this.recordsBefore(
      userId,
      sets.map((s) => s.exerciseId),
      startedAt,
    );
    const prs = markPrs(sets, history);
    return sets.map((s, i) => ({
      userId,
      exerciseId: s.exerciseId,
      order: i,
      reps: s.reps,
      weightKg: s.weightKg ?? null,
      durationSec: s.durationSec ?? null,
      rpe: s.rpe ?? null,
      warmup: s.warmup ?? false,
      supersetId: s.supersetId ?? null,
      pr: prs[i],
    }));
  }

  private times(startedAt: string, endedAt: string) {
    const start = new Date(startedAt);
    const end = new Date(endedAt);
    if (end < start) {
      throw new BadRequestException("A workout can't end before it starts");
    }
    const durationMin = Math.min(
      1440,
      Math.max(1, Math.round((end.getTime() - start.getTime()) / 60_000)),
    );
    return { start, end, durationMin };
  }

  private calories(
    activityType: string,
    durationMin: number,
    weightKg: number | null,
  ) {
    return Math.round(
      metFor(activityType) * (weightKg ?? 70) * (durationMin / 60),
    );
  }

  /**
   * Saves a finished workout: the sets, with any PRs marked, and the
   * ActivityLog that puts it in the feed, challenges and calories. Sending
   * the same clientId again returns the saved one instead of a copy.
   */
  async save(supabaseId: string, dto: SaveWorkoutDto) {
    const user = await this.resolveUser(supabaseId);
    const existing = await this.prisma.workoutSession.findUnique({
      where: { userId_clientId: { userId: user.id, clientId: dto.clientId } },
      select: { id: true },
    });
    if (existing) return this.detailById(user.id, existing.id);

    await this.checkExercises(dto.sets.map((s) => s.exerciseId));
    const { start, end, durationMin } = this.times(dto.startedAt, dto.endedAt);
    const sets = await this.setsWithPrs(user.id, dto.sets, start);
    const activityType = dto.activityType ?? 'strength_training';

    let sessionId: string;
    try {
      sessionId = await this.prisma.$transaction(async (tx) => {
        const log = await tx.activityLog.create({
          data: {
            userId: user.id,
            activityType,
            durationMin,
            caloriesBurned: this.calories(
              activityType,
              durationMin,
              user.weightKg,
            ),
            calorieMethod: 'met',
            source: 'manual',
            loggedAt: start,
          },
        });
        const session = await tx.workoutSession.create({
          data: {
            userId: user.id,
            clientId: dto.clientId,
            activityLogId: log.id,
            planSession: dto.planSession ?? null,
            title: dto.title?.trim() || null,
            startedAt: start,
            endedAt: end,
            setCount: sets.filter((s) => !s.warmup).length,
            volumeKg: volumeKg(sets),
            prCount: sets.filter((s) => s.pr).length,
            sets: { createMany: { data: sets } },
          },
        });
        if (dto.planSession)
          await this.advancePlan(tx, user.id, dto.planSession);
        return session.id;
      });
    } catch (err) {
      // The same workout sent twice at once: the other request saved it
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const saved = await this.prisma.workoutSession.findUnique({
          where: {
            userId_clientId: { userId: user.id, clientId: dto.clientId },
          },
          select: { id: true },
        });
        if (saved) return this.detailById(user.id, saved.id);
      }
      throw err;
    }
    return this.detailById(user.id, sessionId);
  }

  /** After session k, the plan's next one is k + 1, wrapping round the week. */
  private async advancePlan(
    tx: Prisma.TransactionClient,
    userId: string,
    done: number,
  ) {
    const plan = await tx.workoutPlan.findUnique({ where: { userId } });
    if (!plan) return;
    const n = trainingDays(plan.days).length;
    if (!n || done > n) return;
    await tx.workoutPlan.update({
      where: { id: plan.id },
      data: { nextSession: (done % n) + 1 },
    });
  }

  private async detailById(userId: string, id: string) {
    const s = await this.prisma.workoutSession.findFirst({
      where: { id, userId },
      include: {
        sets: { orderBy: { order: 'asc' } },
        activityLog: {
          select: { id: true, caloriesBurned: true, durationMin: true },
        },
      },
    });
    if (!s) throw new NotFoundException('Workout not found');
    const names = await this.exerciseNames(s.sets.map((x) => x.exerciseId));
    return {
      id: s.id,
      clientId: s.clientId,
      title: s.title,
      planSession: s.planSession,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      setCount: s.setCount,
      volumeKg: s.volumeKg,
      prCount: s.prCount,
      activityLog: s.activityLog,
      sets: s.sets.map((x) => ({
        id: x.id,
        exerciseId: x.exerciseId,
        exerciseName: names.get(x.exerciseId) ?? x.exerciseId,
        reps: x.reps,
        weightKg: x.weightKg,
        durationSec: x.durationSec,
        rpe: x.rpe,
        warmup: x.warmup,
        supersetId: x.supersetId,
        pr: x.pr,
      })),
    };
  }

  private async exerciseNames(ids: string[]) {
    const rows = await this.prisma.exercise.findMany({
      where: { id: { in: [...new Set(ids)] } },
      select: { id: true, name: true },
    });
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  async detail(supabaseId: string, id: string) {
    const user = await this.resolveUser(supabaseId);
    return this.detailById(user.id, id);
  }

  /** Recent workouts, newest first, with the exercises in each. */
  async list(supabaseId: string, limit = 20, before?: string) {
    const user = await this.resolveUser(supabaseId);
    const rows = await this.prisma.workoutSession.findMany({
      where: {
        userId: user.id,
        ...(before ? { startedAt: { lt: new Date(before) } } : {}),
      },
      orderBy: { startedAt: 'desc' },
      take: limit,
      include: {
        sets: { select: { exerciseId: true }, orderBy: { order: 'asc' } },
      },
    });
    const names = await this.exerciseNames(
      rows.flatMap((r) => r.sets.map((s) => s.exerciseId)),
    );
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      planSession: r.planSession,
      startedAt: r.startedAt,
      endedAt: r.endedAt,
      setCount: r.setCount,
      volumeKg: r.volumeKg,
      prCount: r.prCount,
      exercises: [...new Set(r.sets.map((s) => s.exerciseId))].map(
        (id) => names.get(id) ?? id,
      ),
    }));
  }

  /** Replaces a saved workout's sets, title or times; PRs are worked out again. */
  async update(supabaseId: string, id: string, dto: UpdateWorkoutDto) {
    const user = await this.resolveUser(supabaseId);
    const s = await this.prisma.workoutSession.findFirst({
      where: { id, userId: user.id },
      include: { activityLog: true },
    });
    if (!s) throw new NotFoundException('Workout not found');
    const { start, end, durationMin } = this.times(
      dto.startedAt ?? s.startedAt.toISOString(),
      dto.endedAt ?? s.endedAt.toISOString(),
    );
    if (dto.sets) await this.checkExercises(dto.sets.map((x) => x.exerciseId));
    const sets = dto.sets
      ? await this.setsWithPrs(user.id, dto.sets, start)
      : null;

    await this.prisma.$transaction(async (tx) => {
      if (sets) {
        await tx.workoutSet.deleteMany({ where: { sessionId: id } });
        await tx.workoutSet.createMany({
          data: sets.map((x) => ({ ...x, sessionId: id })),
        });
      }
      await tx.workoutSession.update({
        where: { id },
        data: {
          title: dto.title !== undefined ? dto.title.trim() || null : undefined,
          startedAt: start,
          endedAt: end,
          ...(sets
            ? {
                setCount: sets.filter((x) => !x.warmup).length,
                volumeKg: volumeKg(sets),
                prCount: sets.filter((x) => x.pr).length,
              }
            : {}),
        },
      });
      if (durationMin !== s.activityLog.durationMin || dto.startedAt) {
        await tx.activityLog.update({
          where: { id: s.activityLogId },
          data: {
            durationMin,
            loggedAt: start,
            caloriesBurned: this.calories(
              s.activityLog.activityType,
              durationMin,
              user.weightKg,
            ),
          },
        });
      }
    });
    return this.detailById(user.id, id);
  }

  /** Deletes the workout and its activity log. */
  async remove(supabaseId: string, id: string) {
    const user = await this.resolveUser(supabaseId);
    const s = await this.prisma.workoutSession.findFirst({
      where: { id, userId: user.id },
      select: { activityLogId: true },
    });
    if (!s) throw new NotFoundException('Workout not found');
    // Deleting the log deletes the session and its sets
    await this.prisma.activityLog.delete({ where: { id: s.activityLogId } });
    return { ok: true };
  }

  private async pastSessions(
    userId: string,
    exerciseId: string,
    offset: number,
    take = HISTORY_SESSIONS,
  ): Promise<PastSession[]> {
    const sessions = await this.prisma.workoutSession.findMany({
      where: { userId, sets: { some: { exerciseId, warmup: false } } },
      orderBy: { startedAt: 'desc' },
      take,
      select: {
        startedAt: true,
        sets: {
          where: { exerciseId, warmup: false },
          orderBy: { order: 'asc' },
          select: { reps: true, weightKg: true, durationSec: true },
        },
      },
    });
    return sessions.map((s) => ({
      date: localDateOf(s.startedAt, offset),
      sets: s.sets,
    }));
  }

  /** What the rules need about recovery: deficit, protein and last night's sleep. */
  async recovery(
    user: { id: string; supabaseId: string; weightKg: number | null },
    offset: number,
  ): Promise<Recovery> {
    const today = localToday(offset);
    const start = dayRange(addDays(today, -7), offset).start;
    const end = dayRange(today, offset).start;
    const [foods, health, checkIn] = await Promise.all([
      this.prisma.foodLog.findMany({
        where: { userId: user.id, loggedAt: { gte: start, lt: end } },
        select: { loggedAt: true, calories: true, proteinG: true },
      }),
      this.prisma.healthDay.findUnique({
        where: { userId_day: { userId: user.id, day: dateMarker(today) } },
        select: { sleepMinutes: true },
      }),
      this.adaptive.checkIn(user.supabaseId, offset).catch(() => null),
    ]);
    const byDay = new Map<string, { kcal: number; protein: number }>();
    for (const f of foods) {
      const d = localDateOf(f.loggedAt, offset);
      const day = byDay.get(d) ?? { kcal: 0, protein: 0 };
      day.kcal += f.calories;
      day.protein += f.proteinG;
      byDay.set(d, day);
    }
    const days = [...byDay.values()];
    const proteinTargetG = user.weightKg
      ? user.weightKg * PROTEIN_G_PER_KG
      : null;
    const tdee = checkIn?.estimate?.tdee ?? null;
    return {
      dailyBalanceKcal:
        tdee && days.length >= 3
          ? Math.round(
              days.reduce((t, d) => t + d.kcal, 0) / days.length - tdee,
            )
          : null,
      loggedDays: days.length,
      lowProteinDays: proteinTargetG
        ? days.filter((d) => d.protein < proteinTargetG).length
        : 0,
      proteinTargetG,
      sleepMinutes: health?.sleepMinutes ?? null,
    };
  }

  /**
   * For each exercise about to be done: last time's sets, the records to
   * beat, and what the progression rules suggest today. An exercise with no
   * history of its own borrows it from the same movement on the same
   * equipment (a swap from one barbell row to another), so a swap doesn't
   * start from zero.
   */
  async prepare(supabaseId: string, dto: PrepareWorkoutDto, offset: number) {
    const user = await this.resolveUser(supabaseId);
    const ids = dto.exercises.map((e) => e.exerciseId);
    await this.checkExercises(ids);
    const facts = await this.prisma.exercise.findMany({
      where: { id: { in: ids } },
      select: EXERCISE_FACTS,
    });
    const byId = new Map(facts.map((f) => [f.id, f]));
    const recovery = await this.recovery(user, offset).catch(() => NO_RECOVERY);
    const today = localToday(offset);
    const records = await this.recordsBefore(user.id, ids, new Date());

    const exercises = [];
    for (const item of dto.exercises) {
      const e = byId.get(item.exerciseId)!;
      const parsed = parseDetail(item.detail ?? '');
      let history = await this.pastSessions(user.id, e.id, offset);
      let historyFrom: { id: string; name: string } | null = null;
      if (!history.length && e.pattern) {
        const similar = await this.similarWithHistory(user.id, e);
        if (similar) {
          history = await this.pastSessions(user.id, similar.id, offset);
          historyFrom = similar;
        }
      }
      const target = parsed?.kind === 'reps' ? parsed.target : DEFAULT_TARGET;
      const suggestion: Suggestion | null =
        parsed?.kind === 'timed'
          ? null
          : suggest(e, history, target, recovery, today);
      exercises.push({
        exerciseId: e.id,
        name: e.name,
        equipment: e.equipment,
        pattern: e.pattern,
        imageUrl: e.imageUrl,
        detail: item.detail ?? null,
        timed: parsed?.kind === 'timed' ? parsed.target : null,
        last: history[0] ?? null,
        historyFrom,
        records: records.get(e.id) ?? NO_RECORDS,
        suggestion,
      });
    }
    return { today, exercises };
  }

  /** The exercise on the same movement and equipment done most recently. */
  private async similarWithHistory(
    userId: string,
    e: { id: string; pattern: string | null; equipment: string[] },
  ) {
    if (!e.pattern || !e.equipment.length) return null;
    const sameMovement = await this.prisma.exercise.findMany({
      where: {
        pattern: e.pattern,
        equipment: { hasSome: e.equipment },
        id: { not: e.id },
      },
      select: { id: true, name: true },
    });
    if (!sameMovement.length) return null;
    const set = await this.prisma.workoutSet.findFirst({
      where: {
        userId,
        warmup: false,
        exerciseId: { in: sameMovement.map((x) => x.id) },
      },
      orderBy: { session: { startedAt: 'desc' } },
      select: { exerciseId: true },
    });
    return set ? sameMovement.find((x) => x.id === set.exerciseId)! : null;
  }

  /** One exercise's history: each session's sets, best estimate and top weight. */
  async history(supabaseId: string, exerciseId: string, offset: number) {
    const user = await this.resolveUser(supabaseId);
    const exercise = await this.prisma.exercise.findUnique({
      where: { id: exerciseId },
      select: EXERCISE_FACTS,
    });
    if (!exercise) throw new NotFoundException('Exercise not found');
    const sessions = await this.prisma.workoutSession.findMany({
      where: { userId: user.id, sets: { some: { exerciseId } } },
      orderBy: { startedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        startedAt: true,
        sets: {
          where: { exerciseId },
          orderBy: { order: 'asc' },
          select: {
            reps: true,
            weightKg: true,
            durationSec: true,
            warmup: true,
            pr: true,
          },
        },
      },
    });
    const all: SetRow[] = sessions.flatMap((s) =>
      s.sets.map((x) => ({ ...x, exerciseId })),
    );
    return {
      exercise,
      records: recordsOf(all),
      sessions: sessions.map((s) => {
        const working = s.sets.filter((x) => !x.warmup);
        const e1rms = working
          .map((x) => epley(x.weightKg, x.reps))
          .filter((x): x is number => x != null);
        const weights = working
          .map((x) => x.weightKg)
          .filter((x): x is number => x != null);
        return {
          sessionId: s.id,
          date: localDateOf(s.startedAt, offset),
          sets: s.sets,
          bestE1rm: e1rms.length ? Math.max(...e1rms) : null,
          topWeightKg: weights.length ? Math.max(...weights) : null,
          bestReps: working.length
            ? Math.max(...working.map((x) => x.reps))
            : null,
        };
      }),
    };
  }

  /**
   * "bench 80 for 8, 8, 7" → sets. Common phrasings are read here; the rest
   * go to the model, which needs AI consent and uses a smart-logging turn.
   */
  async parse(supabaseId: string, dto: ParseSetsDto, offset: number) {
    const user = await this.resolveUser(supabaseId);
    const exercises = (
      await this.prisma.exercise.findMany({
        where: { id: { in: dto.exerciseIds } },
        select: { id: true, name: true },
      })
    ).sort(
      (a, b) => dto.exerciseIds.indexOf(a.id) - dto.exerciseIds.indexOf(b.id),
    );

    const local = parseSpokenSets(dto.text, exercises);
    if (local)
      return { sets: await this.named(local), source: 'rules' as const };

    assertAiConsent(user);
    const today = localToday(offset);
    await takeParse(this.prisma, user.id, today);
    let parsed: {
      sets: {
        exerciseId: string;
        exerciseName: string;
        reps: number;
        weight: number | null;
        unit: 'kg' | 'lb';
        durationSec: number | null;
      }[];
    };
    try {
      const response = await this.openai.responses.create({
        model: this.model,
        instructions: workoutInstructions(exercises),
        input: dto.text,
        max_output_tokens: 3000,
        reasoning: { effort: 'low' },
        store: false,
        text: {
          format: {
            type: 'json_schema',
            name: 'workout_sets',
            strict: true,
            schema: workoutSchema(
              exercises.map((e) => e.id),
            ) as unknown as Record<string, unknown>,
          },
        },
      });
      parsed = JSON.parse(response.output_text) as typeof parsed;
      if (!Array.isArray(parsed.sets)) throw new Error('No sets');
    } catch (err) {
      this.logger.warn(`Set parse failed: ${(err as Error).message}`);
      await giveBackParse(this.prisma, user.id, today);
      throw new BadGatewayException(
        "Couldn't read those sets right now. Try again, or add them by hand.",
      );
    }

    const sets: SpokenSet[] = [];
    for (const s of parsed.sets.slice(0, 30)) {
      let id = s.exerciseId;
      if (!id && s.exerciseName?.trim()) {
        const hit = await this.findByName(s.exerciseName);
        id = hit?.id ?? '';
      }
      const reps = Math.round(s.reps);
      const durationSec =
        s.durationSec && s.durationSec > 0
          ? Math.min(3600, Math.round(s.durationSec))
          : null;
      const weightKg =
        s.weight && s.weight > 0
          ? round1(s.unit === 'lb' ? s.weight * LB : s.weight)
          : null;
      if (!id || (!durationSec && (reps < 1 || reps > 100))) continue;
      if (weightKg != null && weightKg > 500) continue;
      sets.push({
        exerciseId: id,
        reps: durationSec ? 0 : reps,
        weightKg,
        durationSec,
      });
    }
    return { sets: await this.named(sets), source: 'ai' as const };
  }

  /** The library exercise a name means: exact, then a common lift, then the shortest match. */
  private async findByName(raw: string) {
    const name = raw.trim();
    const rows = await this.prisma.exercise.findMany({
      where: { name: { contains: name, mode: 'insensitive' } },
      select: { id: true, name: true },
      take: 40,
    });
    const lower = name.toLowerCase();
    const rank = (e: { id: string; name: string }) => {
      if (e.name.toLowerCase() === lower) return -1000;
      const common = COMMON_EXERCISES.indexOf(e.id);
      if (common >= 0) return -500 + common;
      return (e.name.toLowerCase().startsWith(lower) ? 0 : 100) + e.name.length;
    };
    return rows.sort((a, b) => rank(a) - rank(b))[0] ?? null;
  }

  private async named(sets: SpokenSet[]) {
    const names = await this.exerciseNames(sets.map((s) => s.exerciseId));
    return sets.map((s) => ({
      ...s,
      exerciseName: names.get(s.exerciseId) ?? s.exerciseId,
    }));
  }

  /**
   * For the coach: what's next in the plan and what the rules say about it,
   * plus this week's PRs. Empty when there's nothing to say.
   */
  async coachLines(
    user: { id: string; supabaseId: string; weightKg: number | null },
    offset: number,
  ): Promise<string[]> {
    const plan = await this.prisma.workoutPlan.findUnique({
      where: { userId: user.id },
    });
    const lines: string[] = [];
    const weekAgo = dayRange(addDays(localToday(offset), -7), offset).start;
    const prs = await this.prisma.workoutSet.findMany({
      where: {
        userId: user.id,
        pr: { not: null },
        session: { startedAt: { gte: weekAgo } },
      },
      select: { exerciseId: true, reps: true, weightKg: true },
      take: 5,
    });
    if (prs.length) {
      const names = await this.exerciseNames(prs.map((p) => p.exerciseId));
      lines.push(
        `- PRs this week: ${prs.map((p) => `${names.get(p.exerciseId)} ${p.weightKg ? `${p.weightKg} kg × ${p.reps}` : `${p.reps} reps`}`).join('; ')}`,
      );
    }
    const days = trainingDays<{
      rest: boolean;
      title: string;
      exercises: { exerciseId?: string; detail: string }[];
    }>(plan?.days);
    if (!plan || !days.length) return lines;
    const n = Math.min(Math.max(plan.nextSession, 1), days.length);
    const next = days[n - 1];
    const items = next.exercises.filter((e) => e.exerciseId).slice(0, 8);
    if (!items.length) return lines;
    const prepared = await this.prepare(
      user.supabaseId,
      {
        exercises: items.map((e) => ({
          exerciseId: e.exerciseId!,
          detail: e.detail,
        })),
      },
      offset,
    ).catch(() => null);
    if (!prepared) return lines;
    lines.push(
      `- Next up in their plan: session ${n} of ${days.length}, "${next.title}"`,
    );
    for (const e of prepared.exercises) {
      if (!e.suggestion || e.suggestion.action === 'start') continue;
      const w = e.suggestion.weightKg
        ? `${e.suggestion.weightKg} kg`
        : 'bodyweight';
      lines.push(
        `- ${e.name}: ${e.suggestion.action} → ${w} × ${e.suggestion.reps}. ${e.suggestion.reasons.join(' ')}`,
      );
    }
    return lines;
  }
}
