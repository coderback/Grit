import { addDays } from '../common/day';

/**
 * Consecutive completed days ending today or yesterday. One missed day is
 * forgiven once, as long as the day before it was completed.
 */
export function calculateStreak(
  completedDates: Set<string>,
  today: string,
): number {
  // Allow streak to start from today OR yesterday
  let cursor = completedDates.has(today) ? today : addDays(today, -1);
  if (!completedDates.has(cursor)) return 0;

  let streak = 0;
  let graceUsed = false;

  while (true) {
    if (completedDates.has(cursor)) {
      streak++;
      cursor = addDays(cursor, -1);
    } else if (!graceUsed && completedDates.has(addDays(cursor, -1))) {
      graceUsed = true;
      cursor = addDays(cursor, -1);
    } else {
      break;
    }
  }

  return streak;
}

/** Last 30 days as [{date, completed}], oldest → newest */
export function build30DayGrid(
  completedDates: Set<string>,
  today: string,
): { date: string; completed: boolean }[] {
  return Array.from({ length: 30 }, (_, i) => {
    const date = addDays(today, i - 29);
    return { date, completed: completedDates.has(date) };
  });
}
