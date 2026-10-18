/**
 * Calendar-day helpers that work in the user's local time.
 *
 * The mobile app sends its UTC offset (local minus UTC, in minutes) with every
 * request, so "today", day ranges and week boundaries match the user's clock
 * instead of the server's. Dates are passed around as YYYY-MM-DD strings.
 */

const MS_PER_MIN = 60_000;
const MS_PER_DAY = 86_400_000;

/** The user's local calendar date for an instant. */
export function localDateOf(instant: Date, offsetMin: number): string {
  return new Date(instant.getTime() + offsetMin * MS_PER_MIN)
    .toISOString()
    .slice(0, 10);
}

export function localToday(offsetMin: number): string {
  return localDateOf(new Date(), offsetMin);
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}

/** UTC instants covering one local calendar day: start inclusive, end exclusive. */
export function dayRange(
  date: string,
  offsetMin: number,
): { start: Date; end: Date } {
  const start = Date.parse(`${date}T00:00:00Z`) - offsetMin * MS_PER_MIN;
  return { start: new Date(start), end: new Date(start + MS_PER_DAY) };
}

/** Local date of the Monday starting the week that contains `date`. */
export function weekStart(date: string): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(date, -((day + 6) % 7));
}

/**
 * Habit check-ins are per calendar day, so they are stored as midnight UTC of
 * the local date. This keeps the (habit, user, day) unique constraint working
 * whatever the user's timezone.
 */
export function dateMarker(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}
