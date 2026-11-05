/**
 * Strength helpers for the workout screen: plate and warm-up calculators,
 * PR checks as sets are ticked, and rest timers. The backend marks PRs
 * again when the workout is saved; these just show them as they happen.
 */

export interface Records {
  e1rm: number | null;
  weightKg: number | null;
  reps: number | null;
}

export const round1 = (n: number) => Math.round(n * 10) / 10;

/** Epley's estimated one-rep max, up to 10 reps. */
export function epley(weightKg: number | null | undefined, reps: number) {
  if (!weightKg || weightKg <= 0 || reps < 1 || reps > 10) return null;
  return reps === 1 ? weightKg : round1(weightKg * (1 + reps / 30));
}

export type PrKind = 'e1rm' | 'weight' | 'reps';

/** The record a set beats, if any. Nothing counts until there's history to beat. */
export function prOf(set: { reps: number; weightKg?: number | null; warmup?: boolean; durationSec?: number | null }, before: Records): PrKind | null {
  if (set.warmup || set.reps <= 0) return null;
  if (set.weightKg && set.weightKg > 0) {
    if (before.weightKg == null) return null;
    if (set.weightKg > before.weightKg) return 'weight';
    const e = epley(set.weightKg, set.reps);
    return e != null && before.e1rm != null && e > before.e1rm ? 'e1rm' : null;
  }
  if (set.durationSec) return null;
  return before.reps != null && set.reps > before.reps ? 'reps' : null;
}

/** Records after a set is done. */
export function withSet(r: Records, set: { reps: number; weightKg?: number | null; warmup?: boolean }): Records {
  if (set.warmup || set.reps <= 0) return r;
  const max = (a: number | null, b: number | null) => (a == null ? b : b == null ? a : Math.max(a, b));
  if (set.weightKg && set.weightKg > 0) {
    return { ...r, weightKg: max(r.weightKg, set.weightKg), e1rm: max(r.e1rm, epley(set.weightKg, set.reps)) };
  }
  return { ...r, reps: max(r.reps, set.reps) };
}

export const PR_LABELS: Record<PrKind, string> = {
  weight: 'Heaviest yet',
  e1rm: 'Best estimated 1RM',
  reps: 'Most reps yet',
};

// Standard plates, per side, in kg
export const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25] as const;

/**
 * Plates per side for a barbell weight. `rest` is what can't be made with
 * the plates (e.g. 0.5 kg), so the screen can say so.
 */
export function platesFor(totalKg: number, barKg = 20, plates: readonly number[] = PLATES_KG) {
  let side = (totalKg - barKg) / 2;
  if (side <= 0) return { perSide: [] as number[], rest: Math.max(0, round1(totalKg - barKg)) };
  const perSide: number[] = [];
  for (const p of plates) {
    while (side + 1e-9 >= p) {
      perSide.push(p);
      side -= p;
    }
  }
  return { perSide, rest: round1(side * 2) };
}

/**
 * Warm-up sets before a working weight: the empty bar, then about 40%, 60%
 * and 80%, rounded to 2.5 kg, with fewer reps as the weight climbs. Lighter
 * working weights get fewer warm-ups.
 */
export function warmupsFor(workingKg: number, barKg = 20) {
  if (workingKg <= barKg) return [];
  const steps: [number, number][] = [
    [0.4, 5],
    [0.6, 3],
    [0.8, 2],
  ];
  const out: { weightKg: number; reps: number }[] = [{ weightKg: barKg, reps: 10 }];
  for (const [pct, reps] of steps) {
    const w = Math.round((workingKg * pct) / 2.5) * 2.5;
    if (w > out[out.length - 1].weightKg && w < workingKg) out.push({ weightKg: w, reps });
  }
  return out;
}

export type SetKind = 'warmup' | 'working' | 'superset';

// Rest after a set, by kind: short after warm-ups, none between the
// exercises of a superset, longer after heavy compound work
export function restSeconds(kind: SetKind, compound: boolean) {
  if (kind === 'warmup') return 45;
  if (kind === 'superset') return 0;
  return compound ? 150 : 90;
}

export function formatClock(totalSec: number) {
  const s = Math.max(0, Math.round(totalSec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/** "3 × 8–12" → sets and reps, as the backend reads it. */
export function parseDetail(detail: string) {
  const d = detail.toLowerCase().replace(/\s+/g, ' ').trim();
  const timed = /^(\d{1,2}) ?[x×] ?(\d{1,3}) ?(s|sec|secs|seconds)\b/.exec(d);
  if (timed) return { kind: 'timed' as const, sets: +timed[1], seconds: +timed[2] };
  const m = /^(\d{1,2}) ?[x×] ?(\d{1,3})(?: ?(?:-|–|—|to) ?(\d{1,3}))?(?!\d)(?! ?(?:s|sec|secs|seconds|min|mins|m)\b)/.exec(d);
  if (!m) return null;
  const a = +m[2];
  const b = m[3] ? +m[3] : a;
  return { kind: 'reps' as const, sets: +m[1], repsLow: Math.min(a, b), repsHigh: Math.max(a, b) };
}
