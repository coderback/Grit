import { addDays } from '../common/day';
import { checkInsFor, type CheckInInput } from './coach-checkins';

const today = '2026-11-04';
const ago = (n: number) => addDays(today, -n);
const base: CheckInInput = {
  today,
  foodDays: [0, 1, 2, 3, 4, 5, 6].map(ago),
  proteinByDay: [1, 2, 3, 4, 5].map((n) => ({ date: ago(n), proteinG: 140 })),
  proteinTarget: 150,
  dietType: null,
  workoutDays: [1, 3, 5, 8].map(ago),
  weights: [],
  primaryGoal: 'lose_weight',
};
const rules = (over: Partial<CheckInInput>) =>
  checkInsFor({ ...base, ...over }).map((c) => c.rule);

describe('checkInsFor', () => {
  it('says nothing when things are on track', () => {
    expect(checkInsFor(base)).toEqual([]);
  });

  it('notices when logging stops after a regular run', () => {
    const [c] = checkInsFor({ ...base, foodDays: [3, 4, 6, 9].map(ago) });
    expect(c.rule).toBe('logging_gap');
    expect(c.body).toContain('No meals logged for 3 days');
    // Never a regular logger: nothing to say
    expect(rules({ foodDays: [10].map(ago) })).not.toContain('logging_gap');
    // Logged today: fine
    expect(rules({ foodDays: [0, 5, 6, 7].map(ago) })).not.toContain(
      'logging_gap',
    );
  });

  it('notices a run of missed workouts', () => {
    const [c] = checkInsFor({ ...base, workoutDays: [5, 7, 9].map(ago) });
    expect(c).toMatchObject({ rule: 'activity_gap', screen: 'activity' });
    expect(c.body).toContain("It's been 5 days");
    expect(rules({ workoutDays: [4, 7, 9].map(ago) })).not.toContain(
      'activity_gap',
    );
    expect(rules({ workoutDays: [] })).not.toContain('activity_gap');
  });

  it('flags low protein, with ideas that fit the diet', () => {
    const low = [1, 2, 3, 4].map((n) => ({ date: ago(n), proteinG: 90 }));
    const [c] = checkInsFor({ ...base, proteinByDay: low, dietType: 'vegan' });
    expect(c.rule).toBe('protein_low');
    expect(c.body).toContain('averaged 90 g');
    expect(c.body).toContain('tofu');
    // Three days isn't enough to judge
    expect(rules({ proteinByDay: low.slice(0, 3) })).toEqual([]);
  });

  it('spots a plateau only when losing weight and weighing in regularly', () => {
    const flat = [20, 17, 14, 10, 7, 3, 0].map((n, i) => ({
      date: ago(n),
      weightKg: 80 + (i % 2 ? 0.2 : -0.2),
    }));
    expect(rules({ weights: flat })).toEqual(['plateau']);
    expect(rules({ weights: flat, primaryGoal: 'build_muscle' })).toEqual([]);
    const falling = flat.map((w, i) => ({ ...w, weightKg: 82 - i * 0.3 }));
    expect(rules({ weights: falling })).toEqual([]);
    expect(rules({ weights: flat.slice(0, 5) })).toEqual([]);
  });

  it('lists the most useful first', () => {
    expect(
      rules({
        foodDays: [4, 5, 6].map(ago),
        workoutDays: [6, 8, 10].map(ago),
      }),
    ).toEqual(['logging_gap', 'activity_gap']);
  });
});
