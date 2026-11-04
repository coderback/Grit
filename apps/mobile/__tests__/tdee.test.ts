import { calcAdjustedCalories, calcBMR, calcMacros, calcTDEE, calcTimeline } from '@/lib/tdee';

describe('calorie maths', () => {
  it('Mifflin-St Jeor BMR', () => {
    // 10*80 + 6.25*180 - 5*30 = 1775
    expect(calcBMR('male', 80, 180, 30)).toBe(1780);
    expect(calcBMR('female', 80, 180, 30)).toBe(1614);
    expect(calcBMR('other', 80, 180, 30)).toBe(1697);
  });

  it('TDEE by activity level, sedentary when unknown', () => {
    expect(calcTDEE(1780, 'active')).toBe(2759);
    expect(calcTDEE(1780, 'nonsense')).toBe(2136);
  });

  it('deficit or surplus by goal and pace, never under 1200 to lose', () => {
    expect(calcAdjustedCalories(2500, 'lose_weight', 'moderate')).toBe(1950);
    expect(calcAdjustedCalories(2500, 'build_muscle', 'slow')).toBe(2775);
    expect(calcAdjustedCalories(2500, 'maintain', 'aggressive')).toBe(2500);
    expect(calcAdjustedCalories(1500, 'lose_weight', 'aggressive')).toBe(1200);
  });

  it('macro splits match the backend', () => {
    expect(calcMacros(2000, 'high_protein')).toEqual({ proteinG: 200, carbsG: 150, fatG: 67 });
    expect(calcMacros(2000, 'balanced')).toEqual({ proteinG: 150, carbsG: 200, fatG: 67 });
    expect(calcMacros(2000, 'low_carb')).toEqual({ proteinG: 150, carbsG: 100, fatG: 111 });
    expect(calcMacros(2000)).toEqual(calcMacros(2000, 'balanced'));
  });

  it('weeks to goal', () => {
    expect(calcTimeline(90, 80, 'moderate')).toBe(20);
    expect(calcTimeline(80, 80, 'moderate')).toBeNull();
    expect(calcTimeline(90, 80, 'unknown')).toBeNull();
  });
});
