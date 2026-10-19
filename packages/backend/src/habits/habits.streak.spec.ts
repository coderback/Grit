import { addDays } from '../common/day';
import { build30DayGrid, calculateStreak } from './habits.streak';

const TODAY = '2026-10-19';

/** The `count` consecutive days ending `daysAgo` days before TODAY. */
function run(count: number, daysAgo = 0): string[] {
  return Array.from({ length: count }, (_, i) =>
    addDays(TODAY, -(daysAgo + i)),
  );
}

const streak = (dates: string[]) => calculateStreak(new Set(dates), TODAY);

describe('calculateStreak', () => {
  it('is 0 with no check-ins', () => {
    expect(streak([])).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    expect(streak(run(5))).toBe(5);
  });

  it('still counts when today has not been checked off yet', () => {
    expect(streak(run(4, 1))).toBe(4);
  });

  it('is 0 when the last check-in was two days ago', () => {
    expect(streak(run(10, 2))).toBe(0);
  });

  it('forgives one missed day', () => {
    // 3 days, a gap yesterday-but-one, then 4 more
    expect(streak([...run(3), ...run(4, 4)])).toBe(7);
  });

  it('only forgives one missed day', () => {
    expect(streak([...run(2), ...run(2, 3), ...run(5, 6)])).toBe(4);
  });

  it('stops at a two-day gap', () => {
    expect(streak([...run(3), ...run(5, 5)])).toBe(3);
  });

  it('keeps counting well past the 30-day grid', () => {
    expect(streak(run(400))).toBe(400);
  });
});

describe('build30DayGrid', () => {
  it('covers the 30 days ending today, oldest first', () => {
    const grid = build30DayGrid(new Set([TODAY, addDays(TODAY, -29)]), TODAY);

    expect(grid).toHaveLength(30);
    expect(grid[0]).toEqual({ date: addDays(TODAY, -29), completed: true });
    expect(grid[29]).toEqual({ date: TODAY, completed: true });
    expect(grid.filter((d) => d.completed)).toHaveLength(2);
  });

  it('ignores check-ins older than 30 days', () => {
    const grid = build30DayGrid(new Set([addDays(TODAY, -30)]), TODAY);
    expect(grid.every((d) => !d.completed)).toBe(true);
  });
});
