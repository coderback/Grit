import { addDaysStr, dayLabel, loggedAtFor, weekLabel, weekStartStr } from '@/lib/date';

describe('local dates', () => {
  it('adds days across months and years', () => {
    expect(addDaysStr('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysStr('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDaysStr('2028-03-01', -1)).toBe('2028-02-29');
  });
  it('labels days', () => {
    expect(dayLabel('2026-11-04', '2026-11-04')).toBe('Today');
    expect(dayLabel('2026-11-03', '2026-11-04')).toBe('Yesterday');
    expect(dayLabel('2026-11-02', '2026-11-04')).toBe('Mon 2 Nov');
  });
  it('finds the Monday and labels the week', () => {
    expect(weekStartStr('2026-11-08')).toBe('2026-11-02'); // Sunday
    expect(weekStartStr('2026-11-02')).toBe('2026-11-02');
    expect(weekLabel('2026-11-02')).toBe('2 – 8 Nov');
    expect(weekLabel('2026-10-26')).toBe('26 Oct – 1 Nov');
  });
  it('back-dated logs land at local midday; today uses the server clock', () => {
    expect(loggedAtFor('2026-11-04', '2026-11-04')).toBeUndefined();
    const iso = loggedAtFor('2026-11-01', '2026-11-04')!;
    expect(new Date(iso).getHours()).toBe(12);
    expect(new Date(iso).getDate()).toBe(1);
  });
});
