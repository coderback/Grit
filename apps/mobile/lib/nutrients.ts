/**
 * Vitamins, minerals, fibre, sodium and saturated fat: the shapes of
 * GET /nutrients/day and /nutrients/week, and how the app words and draws
 * them. Wording rule: "low" and "good source", never "deficient" or
 * anything diagnostic.
 */

/** The nutrient codes GRIT tracks (the server's NUTRIENTS, in its order). */
export type NutrientCode =
  | 'kcal' | 'protein_g' | 'carbs_g' | 'sugars_g' | 'fat_g' | 'sat_fat_g' | 'fibre_g' | 'sodium_mg'
  | 'vit_a_ug' | 'vit_c_mg' | 'vit_d_ug' | 'vit_e_mg' | 'vit_k_ug'
  | 'b1_mg' | 'b2_mg' | 'b3_mg' | 'b6_mg' | 'b12_ug' | 'folate_ug'
  | 'calcium_mg' | 'iron_mg' | 'magnesium_mg' | 'potassium_mg' | 'zinc_mg' | 'phosphorus_mg' | 'selenium_ug'
  | 'caffeine_mg' | 'alcohol_g';

/** 'over' is for limits only; null means too little data to judge. */
export type NutrientStatus = 'low' | 'ok' | 'over' | null;

export interface DayNutrient {
  code: NutrientCode | (string & {});
  name: string;
  unit: string;
  group: 'energy' | 'vitamin' | 'mineral' | 'other';
  /** target: more is better up to it; limit: stay under it; none: a number only */
  kind: 'target' | 'limit' | 'none';
  amount: number;
  /** The target, or the limit for kind 'limit'; null for kind 'none' */
  target: number | null;
  percent: number | null;
  /** Share of the day's kcal whose logs have this nutrient */
  coverage: number;
  status: NutrientStatus;
  /** Up to 2 logged foods giving the most */
  sources: { name: string; amount: number }[];
}

export interface NutrientDay {
  date: string;
  calories: number;
  entries: number;
  /** Share of the day's kcal from logs with micronutrient data, 0–1 */
  coverage: number;
  /** Enough of the day is logged to call anything low (always false for today) */
  judged: boolean;
  /**
   * Today, still being logged: no target nutrient is called low (status
   * null), but a limit already passed is 'over'. Optional for older servers.
   */
  inProgress?: boolean;
  nutrients: DayNutrient[];
}

export interface OftenLowNutrient {
  code: NutrientCode | (string & {});
  name: string;
  unit: string;
  target: number;
  lowDays: number;
  days: number;
  avgPercent: number;
}

export interface NutrientWeek {
  weekStart: string;
  weekEnd: string;
  loggedDays: number;
  judgedDays: number;
  oftenLow: OftenLowNutrient[];
}

/** 1,840 */
function grouped(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** An amount at a sensible precision: "1,840", "18", "9.4", "0.35", "0". */
export function formatAmount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n >= 10) return grouped(Math.round(n));
  if (n >= 1) return String(Math.round(n * 10) / 10);
  return String(Number(n.toPrecision(2)));
}

/** "9.4 / 18 mg", "1,840 / 2,300 mg max", or "9.4 mg" with no target. */
export function amountText(n: Pick<DayNutrient, 'amount' | 'target' | 'unit' | 'kind'>): string {
  if (n.target == null) return `${formatAmount(n.amount)} ${n.unit}`;
  return `${formatAmount(n.amount)} / ${formatAmount(n.target)} ${n.unit}${n.kind === 'limit' ? ' max' : ''}`;
}

/** "52%", or "" when there's no target. */
export function percentText(percent: number | null): string {
  return percent == null ? '' : `${Math.round(percent)}%`;
}

/** How full the bar is, 0–1. */
export function barFraction(percent: number | null): number {
  if (percent == null || !Number.isFinite(percent)) return 0;
  return Math.min(1, Math.max(0, percent / 100));
}

/**
 * The colour token for the bar (read from Colors at render). Without enough
 * data it's grey; while today is still being logged it's a neutral blue, so
 * nothing reads as low or fine before the day is over.
 */
export function barTone(status: NutrientStatus, inProgress = false): 'orange' | 'teal' | 'error' | 'blue' | 'muted' {
  if (status === 'low') return 'orange';
  if (status === 'over') return 'error';
  if (status === 'ok') return 'teal';
  return inProgress ? 'blue' : 'muted';
}

/**
 * The tag next to a nutrient's name. Nothing is called low without enough
 * data, and nothing is tagged while today is still being logged (a limit
 * already passed still shows as over).
 */
export function statusTag(status: NutrientStatus, inProgress = false): { text: string; tone: 'orange' | 'error' | 'muted' } | null {
  if (status === 'low') return { text: 'Low', tone: 'orange' };
  if (status === 'over') return { text: 'Over the limit', tone: 'error' };
  if (status === null && !inProgress) return { text: 'not enough data', tone: 'muted' };
  return null;
}

/** "Iron: 9.4 of 18 mg, 52%, low" for screen readers. */
export function nutrientA11yLabel(n: DayNutrient, inProgress = false): string {
  const amount = n.target == null
    ? `${formatAmount(n.amount)} ${n.unit}`
    : `${formatAmount(n.amount)} of ${formatAmount(n.target)} ${n.unit}${n.kind === 'limit' ? ' limit' : ''}`;
  const tag = statusTag(n.status, inProgress);
  return [`${n.name}: ${amount}`, percentText(n.percent), tag?.text.toLowerCase()].filter(Boolean).join(', ');
}

/**
 * The foods that gave the most, where that's useful: for a target, sources
 * giving at least a tenth of it ("good sources"); for a limit, only when
 * it's over, as where it came from.
 */
export function sourcesLine(n: DayNutrient, isToday: boolean): string | null {
  const list = (n.sources ?? []).filter((s) => s.amount > 0);
  const text = (xs: typeof list) => xs.map((s) => `${s.name} (${formatAmount(s.amount)} ${n.unit})`).join(' · ');
  if (n.kind === 'target') {
    const good = n.target ? list.filter((s) => s.amount >= n.target! * 0.1) : list;
    return good.length ? `Good sources${isToday ? ' today' : ''}: ${text(good)}` : null;
  }
  if (n.kind === 'limit' && n.status === 'over' && list.length) return `Mostly from: ${text(list)}`;
  return null;
}

// The third section, in the order its title names them
const OTHER_ORDER = ['fibre_g', 'sodium_mg', 'sat_fat_g'];

/** Vitamins, Minerals, then fibre, sodium and saturated fat. Empty sections are left out. */
export function nutrientSections(nutrients: DayNutrient[]): { title: string; items: DayNutrient[] }[] {
  const other = nutrients
    .filter((n) => n.group === 'energy' && n.kind !== 'none')
    .sort((a, b) => rank(a.code) - rank(b.code));
  return [
    { title: 'Vitamins', items: nutrients.filter((n) => n.group === 'vitamin') },
    { title: 'Minerals', items: nutrients.filter((n) => n.group === 'mineral') },
    { title: 'Fibre, sodium and saturated fat', items: other },
  ].filter((s) => s.items.length > 0);
}

function rank(code: string) {
  const i = OTHER_ORDER.indexOf(code);
  return i === -1 ? OTHER_ORDER.length : i;
}

/** "Based on 64% of today's calories". Never shows 0% for a little data. */
export function coverageNote(coverage: number, date: string, today: string, yesterday: string): string {
  const day = date === today ? "today's" : date === yesterday ? "yesterday's" : "the day's";
  if (coverage >= 0.995) return `Based on all of ${day} calories`;
  const pct = Math.max(1, Math.round(coverage * 100));
  return `Based on ${pct}% of ${day} calories`;
}

/** "low on 4 of 4 days" */
export function lowDaysText(n: Pick<OftenLowNutrient, 'lowDays' | 'days'>): string {
  return `low on ${n.lowDays} of ${n.days} day${n.days === 1 ? '' : 's'}`;
}
