/**
 * The coach's daily check-in: the most useful thing to say, if anything,
 * from a few clear patterns in what the user logged. Rules, not a model:
 * cheap to run for everyone, and each message says exactly why it was sent.
 */
import { addDays } from '../common/day';

export type CheckInRule =
  'logging_gap' | 'activity_gap' | 'protein_low' | 'plateau';

export interface CheckInInput {
  /** The user's local date */
  today: string;
  /** Local dates with food logged, any order, over the last 14+ days */
  foodDays: string[];
  /** Protein eaten on each of the last 7 full days that had food logged */
  proteinByDay: { date: string; proteinG: number }[];
  proteinTarget: number;
  dietType: string | null;
  /** Local dates with a workout, over the last 14+ days */
  workoutDays: string[];
  /** Weigh-ins over the last 21 days */
  weights: { date: string; weightKg: number }[];
  primaryGoal: string;
}

export interface CheckIn {
  rule: CheckInRule;
  title: string;
  body: string;
  /** The app screen it opens */
  screen: 'food' | 'activity' | 'stats';
}

const between = (d: string, from: string, to: string) => d >= from && d <= to;
const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

const PROTEIN_IDEAS: Record<string, string> = {
  vegan: 'tofu, tempeh, lentils or soy yogurt',
  vegetarian: 'Greek yogurt, eggs, cottage cheese or lentils',
  pescatarian: 'Greek yogurt, eggs or a tin of tuna',
};

/** Slope of a least-squares line through the weigh-ins, in kg per week. */
function kgPerWeek(weights: { date: string; weightKg: number }[]) {
  const t0 = Date.parse(weights[0].date);
  const pts = weights.map((w) => [
    (Date.parse(w.date) - t0) / 86_400_000,
    w.weightKg,
  ]);
  const n = pts.length;
  const mx = pts.reduce((s, [x]) => s + x, 0) / n;
  const my = pts.reduce((s, [, y]) => s + y, 0) / n;
  const sxx = pts.reduce((s, [x]) => s + (x - mx) ** 2, 0);
  if (sxx === 0) return 0;
  return (pts.reduce((s, [x, y]) => s + (x - mx) * (y - my), 0) / sxx) * 7;
}

/** Every check-in that applies today, most useful first. */
export function checkInsFor(input: CheckInInput): CheckIn[] {
  const { today } = input;
  const out: CheckIn[] = [];

  // Logged regularly, then stopped: nothing yesterday or the day before
  const food = new Set(input.foodDays);
  const recentFood = [0, 1, 2].some((n) => food.has(addDays(today, -n)));
  const earlierFood = [...food].filter((d) =>
    between(d, addDays(today, -14), addDays(today, -3)),
  );
  if (!recentFood && earlierFood.length >= 3) {
    const last = earlierFood.sort().pop()!;
    const ago = daysBetween(last, today);
    out.push({
      rule: 'logging_gap',
      title: 'Quick catch-up?',
      body: `No meals logged for ${ago} days. Tap ✨ Smart log and just describe what you ate: it takes seconds, and rough is fine.`,
      screen: 'food',
    });
  }

  // Trained regularly, then nothing for 5 days
  const workouts = [...new Set(input.workoutDays)].sort();
  const lastWorkout = workouts[workouts.length - 1];
  const earlierWorkouts = workouts.filter((d) =>
    between(d, addDays(today, -14), addDays(today, -5)),
  );
  if (
    lastWorkout &&
    lastWorkout < addDays(today, -4) &&
    earlierWorkouts.length >= 3
  ) {
    out.push({
      rule: 'activity_gap',
      title: 'Ready to get moving again?',
      body: `It's been ${daysBetween(lastWorkout, today)} days since your last workout. Even a 20-minute walk today keeps the habit alive.`,
      screen: 'activity',
    });
  }

  // Short on protein most logged days this week
  const logged = input.proteinByDay;
  if (logged.length >= 4 && input.proteinTarget > 0) {
    const avg = logged.reduce((s, d) => s + d.proteinG, 0) / logged.length;
    if (avg < input.proteinTarget * 0.75) {
      const ideas =
        PROTEIN_IDEAS[input.dietType ?? ''] ??
        'Greek yogurt, eggs, chicken or a tin of tuna';
      out.push({
        rule: 'protein_low',
        title: 'Protein is running low',
        body: `You've averaged ${Math.round(avg)} g of protein against a ${input.proteinTarget} g target this week. Adding ${ideas} to one meal a day closes most of the gap.`,
        screen: 'food',
      });
    }
  }

  // Trying to lose weight, but three weeks without change
  const weights = [...input.weights].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  if (
    input.primaryGoal === 'lose_weight' &&
    weights.length >= 6 &&
    daysBetween(weights[0].date, weights[weights.length - 1].date) >= 14 &&
    Math.abs(kgPerWeek(weights)) < 0.1
  ) {
    out.push({
      rule: 'plateau',
      title: 'Your weight has held steady',
      body: "Your weight's barely moved in three weeks. That's normal now and then. Open Stats to see what your logs say you burn, and whether your target needs a nudge.",
      screen: 'stats',
    });
  }

  return out;
}
