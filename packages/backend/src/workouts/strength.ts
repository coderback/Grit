/**
 * Strength maths: estimated one-rep max, personal records and the rep range
 * in a plan's "3 × 8–12". Pure functions, so they're easy to test.
 */

export interface LoggedSet {
  exerciseId: string;
  reps: number;
  weightKg?: number | null;
  durationSec?: number | null;
  warmup?: boolean;
}

/** The best a lifter has done on one exercise before now. */
export interface Records {
  e1rm: number | null;
  weightKg: number | null;
  // For bodyweight exercises, the most reps in one set
  reps: number | null;
}

export const NO_RECORDS: Records = { e1rm: null, weightKg: null, reps: null };

// Epley's estimate gets unreliable past about 10 reps
export const MAX_E1RM_REPS = 10;

/** Epley's estimated one-rep max, or null for sets it doesn't suit. */
export function epley(weightKg: number | null | undefined, reps: number) {
  if (!weightKg || weightKg <= 0 || reps < 1 || reps > MAX_E1RM_REPS) {
    return null;
  }
  return reps === 1 ? weightKg : round1(weightKg * (1 + reps / 30));
}

export const round1 = (n: number) => Math.round(n * 10) / 10;

const isWorking = (s: LoggedSet) => !s.warmup && s.reps > 0;

/** The records in a list of sets for one exercise (warm-ups don't count). */
export function recordsOf(sets: LoggedSet[]): Records {
  const working = sets.filter(isWorking);
  const max = (xs: (number | null)[]) => {
    const vals = xs.filter((x): x is number => x != null);
    return vals.length ? Math.max(...vals) : null;
  };
  const weighted = working.filter((s) => s.weightKg && s.weightKg > 0);
  return {
    e1rm: max(weighted.map((s) => epley(s.weightKg, s.reps))),
    weightKg: max(weighted.map((s) => s.weightKg ?? null)),
    reps: max(working.filter((s) => !s.weightKg).map((s) => s.reps)),
  };
}

export type PrKind = 'e1rm' | 'weight' | 'reps';

/**
 * Which record, if any, a set beats, given the records before it. A set
 * only counts once there's history to beat: a first session sets the
 * baseline rather than a page of PRs.
 */
export function prOf(set: LoggedSet, before: Records): PrKind | null {
  if (!isWorking(set)) return null;
  if (set.weightKg && set.weightKg > 0) {
    if (before.weightKg == null) return null;
    if (set.weightKg > before.weightKg) return 'weight';
    const e = epley(set.weightKg, set.reps);
    if (e != null && before.e1rm != null && e > before.e1rm) return 'e1rm';
    return null;
  }
  if (set.durationSec) return null;
  return before.reps != null && set.reps > before.reps ? 'reps' : null;
}

/** Each set's PR, in order, with records updating as the session goes. */
export function markPrs(
  sets: LoggedSet[],
  history: Map<string, Records>,
): (PrKind | null)[] {
  const current = new Map(history);
  const hasHistory = (id: string) => {
    const r = history.get(id);
    return !!r && (r.e1rm != null || r.weightKg != null || r.reps != null);
  };
  return sets.map((s) => {
    const before = current.get(s.exerciseId) ?? NO_RECORDS;
    const pr = hasHistory(s.exerciseId) ? prOf(s, before) : null;
    if (isWorking(s)) {
      const merged = recordsOf([s]);
      current.set(s.exerciseId, {
        e1rm: maxOrNull(before.e1rm, merged.e1rm),
        weightKg: maxOrNull(before.weightKg, merged.weightKg),
        reps: maxOrNull(before.reps, merged.reps),
      });
    }
    return pr;
  });
}

const maxOrNull = (a: number | null, b: number | null) =>
  a == null ? b : b == null ? a : Math.max(a, b);

/** Total kilograms moved in working sets. */
export function volumeKg(sets: LoggedSet[]) {
  return Math.round(
    sets.filter(isWorking).reduce((t, s) => t + (s.weightKg ?? 0) * s.reps, 0),
  );
}

export interface PlanTarget {
  sets: number;
  // The rep range; a single number like "3 × 10" is a range of one
  repsLow: number;
  repsHigh: number;
}

export interface TimedTarget {
  sets: number;
  seconds: number;
}

/**
 * Reads a plan exercise's detail: "3 × 8–12", "4x6", "3 × 10" (sets and
 * reps) or "3 × 30 s" (timed). Null for anything else ("20 min easy").
 */
export function parseDetail(
  detail: string,
):
  | { kind: 'reps'; target: PlanTarget }
  | { kind: 'timed'; target: TimedTarget }
  | null {
  const d = detail.toLowerCase().replace(/\s+/g, ' ').trim();
  const timed = /^(\d{1,2}) ?[x×] ?(\d{1,3}) ?(s|sec|secs|seconds)\b/.exec(d);
  if (timed) {
    return {
      kind: 'timed',
      target: { sets: +timed[1], seconds: +timed[2] },
    };
  }
  const m =
    /^(\d{1,2}) ?[x×] ?(\d{1,3})(?: ?(?:-|–|—|to) ?(\d{1,3}))?(?!\d)(?! ?(?:s|sec|secs|seconds|min|mins|m)\b)/.exec(
      d,
    );
  if (!m) return null;
  const sets = +m[1];
  const a = +m[2];
  const b = m[3] ? +m[3] : a;
  if (!sets || !a || sets > 10 || b > 50) return null;
  return {
    kind: 'reps',
    target: { sets, repsLow: Math.min(a, b), repsHigh: Math.max(a, b) },
  };
}
