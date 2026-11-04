/**
 * Pure helpers for scheduled alerts: who is at a given local hour right now,
 * and what their alert says. Kept free of the database so they're easy to test.
 */

const MIN_OFFSET = -12 * 60;
const MAX_OFFSET = 14 * 60;
const DAY_MIN = 24 * 60;

/**
 * UTC offsets (in minutes, half-open ranges) whose local time is within
 * `hour` right now, e.g. everyone for whom it's 8pm-something.
 */
export function offsetRangesAtLocalHour(
  now: Date,
  hour: number,
): { gte: number; lt: number }[] {
  const utcMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  const lo = hour * 60 - utcMin;
  const ranges: { gte: number; lt: number }[] = [];
  for (const shift of [-DAY_MIN, 0, DAY_MIN]) {
    const gte = Math.max(lo + shift, MIN_OFFSET);
    const lt = Math.min(lo + 60 + shift, MAX_OFFSET + 1);
    if (gte < lt) ranges.push({ gte, lt });
  }
  return ranges;
}

export interface AtRiskHabit {
  name: string;
  emoji: string;
  streak: number;
}

/** "Your 12-day 💧 Water streak ends at midnight." */
export function streakAlert(
  habits: AtRiskHabit[],
): { title: string; body: string } | null {
  if (habits.length === 0) return null;
  const sorted = [...habits].sort((a, b) => b.streak - a.streak);
  const top = sorted[0];
  if (sorted.length === 1) {
    return {
      title: '🔥 Keep your streak alive',
      body: `Your ${top.streak}-day ${top.emoji} ${top.name} streak ends at midnight. Check in now.`,
    };
  }
  const others = sorted.length - 1;
  return {
    title: '🔥 Streaks at risk',
    body: `${top.emoji} ${top.name} (${top.streak} days) and ${others} other ${others === 1 ? 'streak end' : 'streaks end'} at midnight. Check in now.`,
  };
}

export interface WeekStats {
  workouts: number;
  activeMinutes: number;
  foodDays: number;
  /** Daily active-minutes goal */
  activeMinutesGoal: number;
}

/** Behind on activity (under half the week's goal) or on logging food (under 4 days). */
export function isOffTrack(w: WeekStats): boolean {
  return w.activeMinutes < (w.activeMinutesGoal * 7) / 2 || w.foodDays < 4;
}

export function weeklyAlert(w: WeekStats): { title: string; body: string } {
  const workouts = `${w.workouts} ${w.workouts === 1 ? 'workout' : 'workouts'}`;
  const summary = `${workouts} · ${w.activeMinutes} active min · food logged ${w.foodDays}/7 days.`;
  const tail = isOffTrack(w)
    ? 'A fresh week starts tomorrow — plan your first workout tonight.'
    : 'Strong week. Keep it rolling.';
  return { title: 'Your week in GRIT', body: `${summary} ${tail}` };
}
