/** Share of calories from each macro, by the goal focus picked in onboarding. */
const MACRO_SPLITS: Record<
  string,
  { protein: number; carbs: number; fat: number }
> = {
  high_protein: { protein: 0.4, carbs: 0.3, fat: 0.3 },
  balanced: { protein: 0.3, carbs: 0.4, fat: 0.3 },
  low_carb: { protein: 0.3, carbs: 0.2, fat: 0.5 },
};

/** Daily macro targets in grams (4 kcal/g protein and carbs, 9 kcal/g fat). */
export function macroTargets(calories: number, goalFocus: string) {
  const split = MACRO_SPLITS[goalFocus] ?? MACRO_SPLITS.balanced;
  return {
    proteinG: Math.round((calories * split.protein) / 4),
    carbsG: Math.round((calories * split.carbs) / 4),
    fatG: Math.round((calories * split.fat) / 9),
  };
}

/** Most unused calories that carry over to the next day. */
export const ROLLOVER_CAP_KCAL = 200;

export interface BudgetInput {
  calorieGoal: number;
  earnbackCalories: boolean;
  rolloverCalories: boolean;
  burnedToday: number;
  // Yesterday's intake, or null if nothing was logged (no free calories for
  // days the user didn't track)
  eatenYesterday: number | null;
}

/** Today's calorie budget: the goal, plus burned calories and rollover if enabled. */
export function calorieBudget(input: BudgetInput) {
  const earnback = input.earnbackCalories
    ? Math.max(0, Math.round(input.burnedToday))
    : 0;
  const rollover =
    input.rolloverCalories && input.eatenYesterday !== null
      ? Math.min(
          ROLLOVER_CAP_KCAL,
          Math.max(0, Math.round(input.calorieGoal - input.eatenYesterday)),
        )
      : 0;
  return {
    goal: input.calorieGoal,
    earnback,
    rollover,
    total: input.calorieGoal + earnback + rollover,
  };
}
