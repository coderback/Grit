import { endedAlert, formatAmount, ranks, scoreFor } from './challenge-rules';

describe('challenge rules', () => {
  const totals = { steps: 12000, minutes: 95, workouts: 3 };
  it('scores by type, treating the old type as steps', () => {
    expect(scoreFor('steps', totals)).toBe(12000);
    expect(scoreFor('group_steps', totals)).toBe(12000);
    expect(scoreFor('active_minutes', totals)).toBe(95);
    expect(scoreFor('workouts', totals)).toBe(3);
  });

  it('formats amounts with units', () => {
    expect(formatAmount('steps', 104200)).toBe('104,200 steps');
    expect(formatAmount('workouts', 1)).toBe('1 workout');
    expect(formatAmount('active_minutes', 300)).toBe('300 active minutes');
  });

  it('ranks with shared places for ties', () => {
    expect(ranks([50, 30, 30, 10])).toEqual([1, 2, 2, 4]);
  });

  it('writes the result for a met and a missed goal', () => {
    expect(
      endedAlert({
        title: 'Step Battle',
        type: 'steps',
        goalValue: 100000,
        total: 104200,
        rank: 2,
        participants: 4,
      }),
    ).toEqual({
      title: '🏁 Step Battle has ended',
      body: 'Goal reached: 104,200 steps of 100,000. You placed #2 of 4.',
    });
    expect(
      endedAlert({
        title: 'Solo',
        type: 'workouts',
        goalValue: 10,
        total: 8,
        rank: 1,
        participants: 1,
      }).body,
    ).toBe('The group got to 80% (8 workouts of 10).');
  });
});
