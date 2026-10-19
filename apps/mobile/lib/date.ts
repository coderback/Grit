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
