/**
 * Day totals of the vitamins, minerals and other nutrients saved with each
 * food log (`FoodLog.nutrients`), and whether any of them look low. Pure
 * functions shared by the Nutrients endpoints, the coach's context and its
 * check-ins, so all three call the same things low.
 *
 * Missing data is never read as "low": a nutrient is only judged on a day
 * that was logged fully enough, and only when the logs that carry it make up
 * most of that day's calories.
 */
import type { Prisma } from '@prisma/client';
import { localDateOf } from '../common/day';
import {
  SODIUM_LIMIT_MG,
  ageOn,
  driTargets,
  satFatLimitG,
} from '../common/dri';
import {
  MICRONUTRIENTS,
  NUTRIENTS,
  isNutrientCode,
  nutrientInfo,
  type NutrientCode,
} from '../food/nutrients';
import { isLoggedDay } from '../progress/adaptive';

/**
 * A nutrient is judged on a day only when the logs carrying it make up at
 * least this share of the day's calories.
 */
export const MIN_NUTRIENT_COVERAGE = 0.6;
/**
 * Low: under this share of the target, pro-rated to the nutrient's coverage.
 * A single RDA is above most people's need, so "under 100%" would call
 * nearly everyone low.
 */
export const LOW_FRACTION = 0.67;
/** Logged foods listed as a nutrient's main sources on a day. */
export const MAX_SOURCES = 2;
/** "Often low": judged on at least this many days... */
export const OFTEN_LOW_MIN_DAYS = 3;
/** ...and low on more than this share of them. */
export const OFTEN_LOW_SHARE = 0.5;

/** Bases shown in Phase 7; estimates arrive in Phase 9. */
const SHOWN_BASES: readonly unknown[] = ['measured', 'label'];

export type NutrientAmounts = Partial<Record<NutrientCode, number>>;
export type NutrientStatus = 'low' | 'ok' | 'over';

/** The parts of a FoodLog row these helpers read. */
export interface NutrientLog {
  loggedAt: Date;
  calories: number;
  /** The food's name, to list sources; leave it out when they aren't needed */
  name?: string;
  nutrients: Prisma.JsonValue | null;
}

export interface NutrientSource {
  name: string;
  amount: number;
}

export interface NutrientDay {
  /** Local date, YYYY-MM-DD */
  date: string;
  /** Calories from all of the day's logs */
  calories: number;
  entries: number;
  /** Sums of the measured and label values */
  totals: NutrientAmounts;
  /** 0–1 by code: share of the day's calories from logs carrying it */
  coverage: NutrientAmounts;
  /** 0–1: share of the day's calories from logs with vitamin or mineral data */
  dataCoverage: number;
  /** The logged foods giving the most of each nutrient, most first */
  sources: Partial<Record<NutrientCode, NutrientSource[]>>;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * The amounts in a stored snapshot. Anything unexpected (unknown codes,
 * non-numbers, negative amounts, estimated values, a malformed blob) is
 * dropped, so it reads as "no data" rather than as a number.
 */
export function parseNutrients(value: unknown): NutrientAmounts {
  const out: NutrientAmounts = {};
  if (!isObject(value)) return out;
  for (const [code, entry] of Object.entries(value)) {
    if (!isNutrientCode(code) || !isObject(entry)) continue;
    const { amount, basis } = entry;
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0)
      continue;
    if (!SHOWN_BASES.includes(basis)) continue;
    out[code] = amount;
  }
  return out;
}

/** One local day's totals, coverage and sources from that day's logs. */
export function nutrientDay(
  date: string,
  logs: readonly NutrientLog[],
): NutrientDay {
  let calories = 0;
  let dataKcal = 0;
  const totals: NutrientAmounts = {};
  const coveredKcal: NutrientAmounts = {};
  const byFood = new Map<NutrientCode, Map<string, number>>();

  for (const log of logs) {
    const kcal = Math.max(0, log.calories);
    calories += kcal;
    const amounts = parseNutrients(log.nutrients);
    if (MICRONUTRIENTS.some((code) => amounts[code] !== undefined)) {
      dataKcal += kcal;
    }
    const name = log.name?.trim();
    for (const [code, amount] of Object.entries(amounts) as [
      NutrientCode,
      number,
    ][]) {
      totals[code] = (totals[code] ?? 0) + amount;
      coveredKcal[code] = (coveredKcal[code] ?? 0) + kcal;
      if (name && amount > 0) {
        const foods = byFood.get(code) ?? new Map<string, number>();
        foods.set(name, (foods.get(name) ?? 0) + amount);
        byFood.set(code, foods);
      }
    }
  }

  const share = (kcal: number) =>
    calories > 0 ? Math.min(1, kcal / calories) : 0;
  const coverage: NutrientAmounts = {};
  for (const [code, kcal] of Object.entries(coveredKcal) as [
    NutrientCode,
    number,
  ][]) {
    coverage[code] = share(kcal);
  }
  const sources: NutrientDay['sources'] = {};
  for (const [code, foods] of byFood) {
    sources[code] = [...foods]
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
      .slice(0, MAX_SOURCES);
  }

  return {
    date,
    calories,
    entries: logs.length,
    totals,
    coverage,
    dataCoverage: share(dataKcal),
    sources,
  };
}

/** Logs grouped into the user's local days, oldest first; only days with a log. */
export function nutrientDays(
  logs: readonly NutrientLog[],
  offset: number,
): NutrientDay[] {
  const byDate = new Map<string, NutrientLog[]>();
  for (const log of logs) {
    const date = localDateOf(log.loggedAt, offset);
    const day = byDate.get(date) ?? [];
    day.push(log);
    byDate.set(date, day);
  }
  return [...byDate]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayLogs]) => nutrientDay(date, dayLogs));
}

/**
 * Whether a day was logged fully enough to call anything low: the adaptive
 * target's rule (at least 2 entries and 40% of the calorie goal).
 */
export function isJudgedDay(day: NutrientDay, calorieGoal: number) {
  return isLoggedDay(day.calories, day.entries, calorieGoal);
}

/**
 * Daily targets for this person on a date: the DRI for their sex and age,
 * the sodium limit, and a saturated-fat limit from their calorie goal.
 */
export function nutrientTargets(
  person: {
    gender: string | null;
    dateOfBirth: Date | null;
    calorieGoal: number;
  },
  on: Date,
): NutrientAmounts {
  return {
    ...driTargets({
      gender: person.gender,
      age: person.dateOfBirth ? ageOn(person.dateOfBirth, on) : null,
    }),
    sodium_mg: SODIUM_LIMIT_MG,
    sat_fat_g: satFatLimitG(person.calorieGoal),
  };
}

/**
 * Low, ok or over (limits only) for one nutrient on one day; null when
 * there's no target or not enough data to say.
 */
export function nutrientStatus(
  code: NutrientCode,
  day: NutrientDay,
  target: number | null | undefined,
  judged: boolean,
): NutrientStatus | null {
  const kind = nutrientInfo(code)?.kind ?? 'none';
  if (kind === 'none' || !target || target <= 0) return null;
  const coverage = day.coverage[code] ?? 0;
  if (!judged || coverage < MIN_NUTRIENT_COVERAGE) return null;
  const amount = day.totals[code] ?? 0;
  if (kind === 'limit') return amount > target ? 'over' : 'ok';
  return amount < LOW_FRACTION * target * coverage ? 'low' : 'ok';
}

/** Target nutrients low on a day that is judged (see isJudgedDay). */
export function lowOnDay(
  day: NutrientDay,
  targets: NutrientAmounts,
): NutrientCode[] {
  return NUTRIENTS.filter(
    (n) =>
      n.kind === 'target' &&
      nutrientStatus(n.code, day, targets[n.code], true) === 'low',
  ).map((n) => n.code);
}

/** A day's amount as a whole-number percent of the target. */
export function percentOfTarget(
  day: NutrientDay,
  code: NutrientCode,
  target: number,
) {
  return Math.round(((day.totals[code] ?? 0) / target) * 100);
}

export interface OftenLow {
  code: NutrientCode;
  /** Days it was low */
  lowDays: number;
  /** Days it could be judged */
  days: number;
  /** Average amount as a percent of the target over those days */
  avgPercent: number;
}

/**
 * Target nutrients low on most of the days they could be judged, most low
 * days first. Pass judged days only (see isJudgedDay).
 */
export function oftenLow(
  days: readonly NutrientDay[],
  targets: NutrientAmounts,
  minDays = OFTEN_LOW_MIN_DAYS,
): OftenLow[] {
  const out: OftenLow[] = [];
  for (const n of NUTRIENTS) {
    const target = targets[n.code];
    if (n.kind !== 'target' || !target) continue;
    const judgedOn = days.filter(
      (d) => (d.coverage[n.code] ?? 0) >= MIN_NUTRIENT_COVERAGE,
    );
    if (judgedOn.length < Math.max(1, minDays)) continue;
    const lowDays = judgedOn.filter(
      (d) => nutrientStatus(n.code, d, target, true) === 'low',
    ).length;
    if (lowDays <= judgedOn.length * OFTEN_LOW_SHARE) continue;
    const avgPercent = Math.round(
      judgedOn.reduce(
        (s, d) => s + ((d.totals[n.code] ?? 0) / target) * 100,
        0,
      ) / judgedOn.length,
    );
    out.push({ code: n.code, lowDays, days: judgedOn.length, avgPercent });
  }
  return out.sort(
    (a, b) => b.lowDays - a.lowDays || a.avgPercent - b.avgPercent,
  );
}

/** Whether any target nutrient could be judged on any of these judged days. */
export function anyJudged(days: readonly NutrientDay[]) {
  return days.some((d) =>
    NUTRIENTS.some(
      (n) =>
        n.kind === 'target' &&
        (d.coverage[n.code] ?? 0) >= MIN_NUTRIENT_COVERAGE,
    ),
  );
}

/** Rounded for display: one decimal under 10, whole numbers above. */
export function displayAmount(amount: number) {
  return amount < 10 ? Math.round(amount * 10) / 10 : Math.round(amount);
}

/** A 0–1 share to two decimals. */
export function roundShare(share: number) {
  return Math.round(share * 100) / 100;
}
