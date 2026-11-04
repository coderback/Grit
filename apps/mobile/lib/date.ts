/** Today's date on the device's clock as YYYY-MM-DD (not the UTC date). */
export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Minutes the device's local time is ahead of UTC (e.g. 60 for UTC+1). */
export function utcOffsetMinutes(): number {
  return -new Date().getTimezoneOffset();
}

/** YYYY-MM-DD shifted by whole days, using calendar dates (safe across DST). */
export function addDaysStr(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return localDateStr(new Date(y, m - 1, d + days));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Today", "Yesterday", or e.g. "Mon 13 Oct". */
export function dayLabel(date: string, today: string = localDateStr()): string {
  if (date === today) return 'Today';
  if (date === addDaysStr(today, -1)) return 'Yesterday';
  const [y, m, d] = date.split('-').map(Number);
  return `${WEEKDAYS[new Date(y, m - 1, d).getDay()]} ${d} ${MONTHS[m - 1]}`;
}

/** "13 – 19 Oct" or "27 Oct – 2 Nov" for a Monday-to-Sunday week. */
export function weekLabel(weekStart: string): string {
  const end = addDaysStr(weekStart, 6);
  const [, m1, d1] = weekStart.split('-').map(Number);
  const [, m2, d2] = end.split('-').map(Number);
  return m1 === m2 ? `${d1} – ${d2} ${MONTHS[m2 - 1]}` : `${d1} ${MONTHS[m1 - 1]} – ${d2} ${MONTHS[m2 - 1]}`;
}

/** Monday of the week containing `date`, as YYYY-MM-DD. */
export function weekStartStr(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay(); // 0 = Sunday
  return addDaysStr(date, -((dow + 6) % 7));
}

/**
 * Timestamp for something logged against an earlier day: midday local time,
 * well away from either midnight. Undefined for today, so the server uses now.
 */
export function loggedAtFor(date: string, today: string = localDateStr()): string | undefined {
  if (date === today) return undefined;
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 12).toISOString();
}
