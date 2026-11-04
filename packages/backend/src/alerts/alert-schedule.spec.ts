import {
  isOffTrack,
  offsetRangesAtLocalHour,
  streakAlert,
  weeklyAlert,
} from './alert-schedule';

const inRanges = (offset: number, ranges: { gte: number; lt: number }[]) =>
  ranges.some((r) => offset >= r.gte && offset < r.lt);

describe('offsetRangesAtLocalHour', () => {
  it('finds the zones where it is 8pm', () => {
    // 19:05 UTC: 8pm in UTC+1 (offsets 55..114 min put local time in 20:00-20:59)
    const ranges = offsetRangesAtLocalHour(
      new Date('2026-11-04T19:05:00Z'),
      20,
    );
    expect(inRanges(60, ranges)).toBe(true);
    expect(inRanges(0, ranges)).toBe(false);
    expect(inRanges(120, ranges)).toBe(false);
  });

  it('handles half-hour zones and wrapping past midnight UTC', () => {
    // 14:35 UTC is 20:05 in India (UTC+5:30)
    expect(
      inRanges(
        330,
        offsetRangesAtLocalHour(new Date('2026-11-04T14:35:00Z'), 20),
      ),
    ).toBe(true);
    // 03:05 UTC is 20:05 the previous day in Los Angeles (UTC-7)
    expect(
      inRanges(
        -420,
        offsetRangesAtLocalHour(new Date('2026-11-04T03:05:00Z'), 20),
      ),
    ).toBe(true);
    // 06:10 UTC is 20:10 in Kiribati (UTC+14)
    expect(
      inRanges(
        840,
        offsetRangesAtLocalHour(new Date('2026-11-04T06:10:00Z'), 20),
      ),
    ).toBe(true);
  });

  it('every real offset is due exactly once a day', () => {
    for (const offset of [-720, -420, 0, 330, 345, 840]) {
      let hits = 0;
      for (let h = 0; h < 24; h++) {
        const now = new Date(Date.UTC(2026, 10, 4, h, 5));
        if (inRanges(offset, offsetRangesAtLocalHour(now, 20))) hits++;
      }
      expect(hits).toBe(1);
    }
  });
});

describe('streakAlert', () => {
  it('names the habit when there is one', () => {
    expect(
      streakAlert([{ name: 'Water', emoji: '💧', streak: 12 }])?.body,
    ).toBe('Your 12-day 💧 Water streak ends at midnight. Check in now.');
  });
  it('leads with the longest streak when there are several', () => {
    expect(
      streakAlert([
        { name: 'Read', emoji: '📚', streak: 3 },
        { name: 'Walk', emoji: '🚶', streak: 9 },
        { name: 'Water', emoji: '💧', streak: 4 },
      ])?.body,
    ).toBe(
      '🚶 Walk (9 days) and 2 other streaks end at midnight. Check in now.',
    );
  });
  it('sends nothing with no streak at risk', () => {
    expect(streakAlert([])).toBeNull();
  });
});

describe('weekly progress', () => {
  const onTrack = {
    workouts: 4,
    activeMinutes: 240,
    foodDays: 6,
    activeMinutesGoal: 60,
  };
  it('is on track with enough activity and food logging', () => {
    expect(isOffTrack(onTrack)).toBe(false);
    expect(weeklyAlert(onTrack).body).toBe(
      '4 workouts · 240 active min · food logged 6/7 days. Strong week. Keep it rolling.',
    );
  });
  it('is off track with too little activity or logging', () => {
    expect(isOffTrack({ ...onTrack, activeMinutes: 100 })).toBe(true);
    expect(isOffTrack({ ...onTrack, foodDays: 3 })).toBe(true);
    expect(
      weeklyAlert({ ...onTrack, workouts: 1, foodDays: 2 }).body,
    ).toContain('1 workout ·');
  });
});
