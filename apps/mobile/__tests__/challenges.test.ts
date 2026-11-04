import { amount, daysLeftLabel, hasEnded, measureName } from '@/lib/challenges';

describe('challenge labels', () => {
  it('formats amounts by type', () => {
    expect(amount('steps', 12400)).toBe('12,400 steps');
    expect(amount('group_steps', 1)).toBe('1 step');
    expect(amount('active_minutes', 95)).toBe('95 min');
    expect(amount('workouts', 1)).toBe('1 workout');
    expect(measureName('workouts')).toBe('workouts');
  });
  it('knows when a challenge has ended', () => {
    const soon = new Date(Date.now() + 3600_000).toISOString();
    const past = new Date(Date.now() - 1000).toISOString();
    expect(hasEnded({ endedAt: null, endDate: soon })).toBe(false);
    expect(hasEnded({ endedAt: null, endDate: past })).toBe(true);
    expect(hasEnded({ endedAt: past, endDate: soon })).toBe(true);
    expect(daysLeftLabel(soon)).toBe('Last day');
    expect(daysLeftLabel(new Date(Date.now() + 3.5 * 86_400_000).toISOString())).toBe('4d left');
    expect(daysLeftLabel(past)).toBe('Ended');
  });
});
