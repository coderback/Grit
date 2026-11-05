/**
 * Progression rules (Phase 6.2): what to lift next time, and why.
 * Deterministic rules, not a model, so they can be tested and explained:
 *
 * - Double progression: once every set reaches the top of the rep range,
 *   add the smallest step the equipment allows (2.5 kg, or 5 kg for the
 *   lower body), never more than 5% of the weight in one go.
 * - Stalls: two sessions in a row with no progress, or two missed weekly
 *   sessions, drop the weight by 10% for a session, then build back up.
 * - Recovery: a deficit of more than 500 kcal a day (Murphy and Koehler,
 *   2022), protein under 1.6 g/kg on most days (Morton et al., 2018) or a
 *   night under 6 h of sleep hold the weight instead of adding to it.
 */
import { round1, type PlanTarget } from './strength';

export interface PastSession {
  /** Local YYYY-MM-DD */
  date: string;
  /** Working sets only (no warm-ups) */
  sets: { reps: number; weightKg: number | null }[];
}

export interface Recovery {
  /** Average daily intake minus the adaptive estimate, over logged days; negative is a deficit */
  dailyBalanceKcal: number | null;
  /** Logged days in the last 7, and how many were under the protein level */
  loggedDays: number;
  lowProteinDays: number;
  /** 1.6 g × body weight, for the explanation */
  proteinTargetG: number | null;
  /** Last night, from the health app */
  sleepMinutes: number | null;
}

export const NO_RECOVERY: Recovery = {
  dailyBalanceKcal: null,
  loggedDays: 0,
  lowProteinDays: 0,
  proteinTargetG: null,
  sleepMinutes: null,
};

export interface ExerciseFacts {
  name: string;
  equipment: string[];
  pattern: string | null;
  primary: string[];
}

export type Action = 'start' | 'increase' | 'reps' | 'hold' | 'deload';
export type HoldReason = 'deficit' | 'protein' | 'sleep';

export interface Suggestion {
  action: Action;
  /** The weight to use, or null for bodyweight or a first session */
  weightKg: number | null;
  sets: number;
  /** Reps to aim for in each set */
  reps: number;
  repsLow: number;
  repsHigh: number;
  holds: HoldReason[];
  /** One line each, for the app and the coach */
  reasons: string[];
}

export const DEFICIT_LIMIT_KCAL = 500;
export const PROTEIN_G_PER_KG = 1.6;
export const SHORT_SLEEP_MIN = 6 * 60;
export const MAX_JUMP = 0.05;
export const DELOAD = 0.9;
// Two missed weekly sessions
export const MISSED_DAYS = 21;

const LOWER_PATTERNS = new Set(['squat', 'hip_hinge', 'lunge', 'calf_raise']);
const LOWER_MUSCLES = new Set([
  'quadriceps',
  'hamstrings',
  'glutes',
  'calves',
  'adductors',
  'abductors',
]);
// Equipment that comes in fixed weights: no fractional plates
const FIXED = new Set(['dumbbell', 'kettlebell']);

export function isLowerBody(e: ExerciseFacts) {
  if (e.pattern) return LOWER_PATTERNS.has(e.pattern);
  return e.primary.some((m) => LOWER_MUSCLES.has(m));
}

/** The smallest usual step for the equipment. */
export function equipmentStep(e: ExerciseFacts) {
  if (e.equipment.includes('kettlebell')) return 4;
  if (e.equipment.includes('dumbbell')) return 2;
  return isLowerBody(e) ? 5 : 2.5;
}

const roundDown = (n: number, to: number) => Math.floor(n / to + 1e-9) * to;
const roundNearest = (n: number, to: number) => Math.round(n / to) * to;

/**
 * The next weight up: one equipment step or 5%, whichever is smaller.
 * Null when even the smallest loadable jump would be more than 5% (light
 * dumbbells, kettlebells): then they add reps instead.
 */
export function nextWeight(weightKg: number, e: ExerciseFacts) {
  const step = equipmentStep(e);
  const cap = weightKg * MAX_JUMP;
  if (e.equipment.some((q) => FIXED.has(q))) {
    return step <= cap ? round1(weightKg + step) : null;
  }
  const jump = roundDown(Math.min(step, cap), 0.5);
  return jump >= 0.5 ? round1(weightKg + jump) : null;
}

export function deloadWeight(weightKg: number, e: ExerciseFacts) {
  const to = e.equipment.some((q) => FIXED.has(q)) ? 1 : 0.5;
  return round1(Math.min(roundNearest(weightKg * DELOAD, to), weightKg - to));
}

const topWeight = (s: PastSession) =>
  Math.max(0, ...s.sets.map((x) => x.weightKg ?? 0));
const repsAt = (s: PastSession, w: number) =>
  s.sets.filter((x) => (x.weightKg ?? 0) === w).reduce((t, x) => t + x.reps, 0);

/** Whether `later` beat `earlier`: more weight, or more reps at the same weight. */
export function progressed(later: PastSession, earlier: PastSession) {
  const a = topWeight(later);
  const b = topWeight(earlier);
  if (a !== b) return a > b;
  return repsAt(later, a) > repsAt(earlier, b);
}

const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

const fmtKg = (n: number) => `${round1(n)} kg`;
const fmtSleep = (m: number) =>
  `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} m` : ''}`;

/** Which recovery signals say to hold the weight, with their explanations. */
export function holdsFor(r: Recovery): {
  holds: HoldReason[];
  reasons: string[];
} {
  const holds: HoldReason[] = [];
  const reasons: string[] = [];
  if (r.dailyBalanceKcal != null && r.dailyBalanceKcal < -DEFICIT_LIMIT_KCAL) {
    holds.push('deficit');
    reasons.push(
      `You're averaging ${Math.round(-r.dailyBalanceKcal)} kcal a day under your burn, so this is a "preserve" week: hold the weight and keep the sets.`,
    );
  }
  if (r.loggedDays >= 4 && r.lowProteinDays > r.loggedDays / 2) {
    holds.push('protein');
    reasons.push(
      `Protein was under ${r.proteinTargetG ? `${Math.round(r.proteinTargetG)} g` : '1.6 g per kg'} on ${r.lowProteinDays} of ${r.loggedDays} logged days: holding the weight until it's up.`,
    );
  }
  if (r.sleepMinutes != null && r.sleepMinutes < SHORT_SLEEP_MIN) {
    holds.push('sleep');
    reasons.push(
      `You slept ${fmtSleep(r.sleepMinutes)} last night: keeping today's weights.`,
    );
  }
  return { holds, reasons };
}

/**
 * What to do next time for one exercise, from its recent sessions (most
 * recent first), the plan's target, recovery, and today's date.
 */
export function suggest(
  e: ExerciseFacts,
  history: PastSession[],
  target: PlanTarget,
  recovery: Recovery,
  today: string,
): Suggestion {
  const base = {
    sets: target.sets,
    repsLow: target.repsLow,
    repsHigh: target.repsHigh,
  };
  const sessions = history.filter((s) => s.sets.length);
  const last = sessions[0];
  const { holds, reasons: holdReasons } = holdsFor(recovery);

  if (!last) {
    return {
      ...base,
      action: 'start',
      weightKg: null,
      reps: target.repsLow,
      holds: [],
      reasons: [
        `First time: pick a weight you could lift for ${target.repsLow} reps with about 2 more in the tank.`,
      ],
    };
  }

  const weight = topWeight(last);
  const bestReps = Math.max(...last.sets.map((s) => s.reps));

  // Bodyweight: progress by reps
  if (weight === 0) {
    if (holds.length) {
      return {
        ...base,
        action: 'hold',
        weightKg: null,
        reps: Math.min(bestReps, target.repsHigh),
        holds,
        reasons: holdReasons,
      };
    }
    return {
      ...base,
      action: 'reps',
      weightKg: null,
      reps: bestReps + 1,
      holds: [],
      reasons: [`Last time your best set was ${bestReps}: aim for one more.`],
    };
  }

  const gap = daysBetween(last.date, today);
  if (gap >= MISSED_DAYS) {
    const w = deloadWeight(weight, e);
    return {
      ...base,
      action: 'deload',
      weightKg: w,
      reps: target.repsLow,
      holds,
      reasons: [
        `It's been ${Math.floor(gap / 7)} weeks since your last ${e.name}: starting 10% lighter at ${fmtKg(w)} to ease back in.`,
      ],
    };
  }

  const atTop = last.sets.filter(
    (s) => (s.weightKg ?? 0) === weight && s.reps >= target.repsHigh,
  ).length;
  const allAtTop = atTop >= target.sets;

  if (allAtTop && !holds.length) {
    const up = nextWeight(weight, e);
    if (up == null) {
      return {
        ...base,
        action: 'reps',
        weightKg: weight,
        reps: target.repsHigh + 1,
        holds: [],
        reasons: [
          `You hit ${target.repsHigh} on every set. The next ${e.equipment.includes('kettlebell') ? 'kettlebell' : 'dumbbell'} up is more than a 5% jump, so add a rep first.`,
        ],
      };
    }
    return {
      ...base,
      action: 'increase',
      weightKg: up,
      reps: target.repsLow,
      holds: [],
      reasons: [
        `You hit ${target.repsHigh} reps on every set last time: up to ${fmtKg(up)}.`,
      ],
    };
  }

  // Two sessions in a row with no progress at the same weight
  const [, prev, before] = sessions;
  const stalled =
    !!prev &&
    !!before &&
    topWeight(prev) === weight &&
    topWeight(before) === weight &&
    !progressed(last, prev) &&
    !progressed(prev, before) &&
    daysBetween(before.date, last.date) <= 42;
  if (stalled && !holds.length) {
    const w = deloadWeight(weight, e);
    return {
      ...base,
      action: 'deload',
      weightKg: w,
      reps: target.repsLow,
      holds: [],
      reasons: [
        `No progress on ${e.name} for two sessions: dropping 10% to ${fmtKg(w)} this week, then building back up.`,
      ],
    };
  }

  const reps = Math.min(
    target.repsHigh,
    Math.max(target.repsLow, Math.min(...last.sets.map((s) => s.reps)) + 1),
  );
  return {
    ...base,
    action: 'hold',
    weightKg: weight,
    reps: holds.length ? Math.min(bestReps, target.repsHigh) : reps,
    holds,
    reasons: holds.length
      ? holdReasons
      : [
          `Same ${fmtKg(weight)}: aim for ${reps} reps a set, up to ${target.repsHigh} before adding weight.`,
        ],
  };
}
