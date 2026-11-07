/**
 * The coach's daily check-in: the most useful thing to say, if anything,
 * from a few clear patterns in what the user logged. Rules, not a model:
 * cheap to run for everyone, and each message says exactly why it was sent.
 */
import { addDays } from '../common/day';
import { nutrientInfo, type NutrientCode } from '../food/nutrients';

export type CheckInRule =
  'logging_gap' | 'activity_gap' | 'protein_low' | 'nutrient_low' | 'plateau';

/** The same nutrient low on this many of the last judged days... */
export const NUTRIENT_LOW_MIN_DAYS = 5;
/** ...out of at most this many (today excluded). */
export const NUTRIENT_LOW_WINDOW = 7;

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
  /**
   * The latest days logged fully enough to judge nutrients (newest first,
   * today excluded), each with the target nutrients low that day and their
   * amounts as a percent of the target.
   */
  nutrientDays?: {
    date: string;
    low: NutrientCode[];
    percent?: Partial<Record<NutrientCode, number>>;
  }[];
  /** 'yes' means they asked not to hear about foods as good or bad */
  edScreen?: string | null;
}

export interface CheckIn {
  rule: CheckInRule;
  title: string;
  body: string;
  /** The app screen it opens */
  screen: 'food' | 'activity' | 'stats';
  /** The nutrient a nutrient_low check-in is about */
  nutrient?: NutrientCode;
}

const between = (d: string, from: string, to: string) => d >= from && d <= to;
const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

const PROTEIN_IDEAS: Record<string, string> = {
  vegan: 'tofu, tempeh, lentils or soy yogurt',
  vegetarian: 'Greek yogurt, eggs, cottage cheese or lentils',
  pescatarian: 'Greek yogurt, eggs or a tin of tuna',
};

type DietIdeas = {
  /** Any diet without its own entry */
  default: string;
  vegetarian?: string;
  vegan?: string;
  halal_kosher?: string;
};

/**
 * Everyday foods that are good sources of each target nutrient, by diet
 * (users.dto DIET_TYPES). Halal / kosher ideas leave out pork and shellfish.
 * Foods only: no supplements.
 */
export const NUTRIENT_IDEAS: Record<string, DietIdeas> = {
  fibre_g: { default: 'oats, beans, lentils, berries or wholegrain bread' },
  vit_a_ug: {
    default: 'carrots, sweet potato, spinach or eggs',
    vegan: 'carrots, sweet potato, spinach or butternut squash',
  },
  vit_c_mg: { default: 'oranges, kiwi, peppers, strawberries or broccoli' },
  vit_d_ug: {
    default: 'oily fish like salmon or sardines, eggs or fortified milk',
    vegetarian: 'eggs, fortified milk or yogurt, or fortified cereal',
    vegan: 'fortified plant milk, fortified cereal or UV-grown mushrooms',
  },
  vit_e_mg: { default: 'sunflower seeds, almonds, hazelnuts or avocado' },
  vit_k_ug: { default: 'kale, spinach, broccoli or cabbage' },
  b1_mg: { default: 'wholegrain bread, oats, beans, peas or sunflower seeds' },
  b2_mg: {
    default: 'milk, yogurt, eggs or mushrooms',
    vegan: 'fortified plant milk, fortified cereal, mushrooms or almonds',
  },
  b3_mg: {
    default: 'chicken, tuna, peanuts or wholegrain bread',
    vegetarian: 'peanuts, mushrooms, wholegrain bread or fortified cereal',
    vegan: 'peanuts, mushrooms, wholegrain bread or fortified cereal',
  },
  b6_mg: {
    default: 'chicken, salmon, potatoes, chickpeas or bananas',
    vegetarian: 'chickpeas, potatoes, bananas or fortified cereal',
    vegan: 'chickpeas, potatoes, bananas or fortified cereal',
  },
  b12_ug: {
    default: 'eggs, milk, yogurt, salmon or beef',
    vegetarian: 'eggs, milk, yogurt or cheese',
    vegan: 'fortified plant milk, fortified cereal or nutritional yeast',
  },
  folate_ug: {
    default: 'lentils, chickpeas, spinach, asparagus or broccoli',
  },
  calcium_mg: {
    default: 'milk, yogurt, cheese or calcium-set tofu',
    vegan: 'calcium-set tofu, fortified plant milk, kale or almonds',
  },
  iron_mg: {
    default: 'beef, lentils, beans, spinach or fortified cereal',
    vegetarian: 'lentils, beans, tofu, spinach or fortified cereal',
    vegan: 'lentils, beans, tofu, spinach or fortified cereal',
  },
  magnesium_mg: {
    default: 'pumpkin seeds, almonds, spinach, black beans or oats',
  },
  potassium_mg: { default: 'potatoes, bananas, beans, lentils or spinach' },
  zinc_mg: {
    default: 'beef, chicken, cheese, chickpeas or pumpkin seeds',
    vegetarian: 'cheese, yogurt, chickpeas, lentils or pumpkin seeds',
    vegan: 'chickpeas, lentils, tofu, oats or pumpkin seeds',
  },
  phosphorus_mg: {
    default: 'milk, yogurt, salmon, lentils or pumpkin seeds',
    vegetarian: 'milk, yogurt, cheese, lentils or pumpkin seeds',
    vegan: 'lentils, beans, tofu, oats or pumpkin seeds',
  },
  selenium_ug: {
    default: 'tuna, sardines, eggs, sunflower seeds or wholegrain bread',
    vegetarian: 'eggs, sunflower seeds, mushrooms or wholegrain bread',
    vegan: 'a Brazil nut or two, sunflower seeds, mushrooms or brown rice',
  },
};

/** Food ideas for a nutrient that fit the diet, or null if there are none. */
export function nutrientIdeas(code: string, dietType: string | null) {
  const ideas = NUTRIENT_IDEAS[code];
  if (!ideas) return null;
  const diet = dietType as keyof DietIdeas | null;
  return (diet && diet !== 'default' && ideas[diet]) || ideas.default;
}

/**
 * The nutrient low on the most of the last judged days, if it was low on
 * enough of them; ties go to the lower average percent of target.
 */
function oftenLowNutrient(input: CheckInInput) {
  const days = (input.nutrientDays ?? []).slice(0, NUTRIENT_LOW_WINDOW);
  if (days.length < NUTRIENT_LOW_MIN_DAYS) return null;
  const counts = new Map<NutrientCode, { count: number; percent: number }>();
  for (const day of days) {
    for (const code of new Set(day.low)) {
      const c = counts.get(code) ?? { count: 0, percent: 0 };
      c.count++;
      c.percent += day.percent?.[code] ?? 0;
      counts.set(code, c);
    }
  }
  const best = [...counts]
    .filter(([code]) => nutrientInfo(code)?.kind === 'target')
    .map(([code, c]) => ({ code, count: c.count, avg: c.percent / c.count }))
    .sort((a, b) => b.count - a.count || a.avg - b.avg)[0];
  return best && best.count >= NUTRIENT_LOW_MIN_DAYS
    ? { code: best.code, count: best.count, of: days.length }
    : null;
}

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

  // The same vitamin, mineral or fibre low on most fully logged days. Not
  // for anyone who asked not to hear about foods as good or bad.
  const nutrient = input.edScreen === 'yes' ? null : oftenLowNutrient(input);
  const ideas = nutrient && nutrientIdeas(nutrient.code, input.dietType);
  if (nutrient && ideas) {
    const name = nutrientInfo(nutrient.code)!.name;
    const fits = input.dietType && input.dietType !== 'none';
    out.push({
      rule: 'nutrient_low',
      title: `${name} has been running low`,
      body: `${name} was low on ${nutrient.count} of your last ${nutrient.of} logged days. Good sources${fits ? ' that fit your diet' : ''} include ${ideas}: adding one to a meal a day helps.`,
      screen: 'food',
      nutrient: nutrient.code,
    });
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
