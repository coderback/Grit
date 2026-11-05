import {
  ageOn,
  calorieFloor,
  hasProEdTerm,
  isUnderMinimumAge,
  maxDailyDeficit,
  weightLossAllowed,
} from './safety';

describe('safety rules', () => {
  it('sets a calorie floor by sex, with the lower one when unknown', () => {
    expect(calorieFloor('male')).toBe(1500);
    expect(calorieFloor('female')).toBe(1200);
    expect(calorieFloor('other')).toBe(1200);
    expect(calorieFloor(null)).toBe(1200);
  });

  it('caps planned loss at 1% of body weight a week', () => {
    expect(maxDailyDeficit(70)).toBe(770); // 0.7 kg × 7700 / 7
    expect(maxDailyDeficit(null)).toBe(Infinity);
  });

  it('works out age on a date, counting the birthday', () => {
    const dob = new Date('2008-06-15T00:00:00Z');
    expect(ageOn(dob, new Date('2026-06-14T12:00:00Z'))).toBe(17);
    expect(ageOn(dob, new Date('2026-06-15T12:00:00Z'))).toBe(18);
    expect(isUnderMinimumAge(dob, new Date('2026-06-14T12:00:00Z'))).toBe(true);
    expect(isUnderMinimumAge(dob, new Date('2026-06-15T12:00:00Z'))).toBe(
      false,
    );
  });

  it('turns off weight-loss targets only for a yes', () => {
    expect(weightLossAllowed('yes')).toBe(false);
    expect(weightLossAllowed('no')).toBe(true);
    expect(weightLossAllowed('prefer_not')).toBe(true);
    expect(weightLossAllowed(null)).toBe(true);
  });

  it('catches pro-eating-disorder terms however they are written', () => {
    expect(hasProEdTerm('Thin-spo goals')).toBe(true);
    expect(hasProEdTerm('pro_ana club')).toBe(true);
    expect(hasProEdTerm('Morning runners')).toBe(false);
    expect(hasProEdTerm('Banana bread')).toBe(false);
    expect(hasProEdTerm('Pro Analysis Club')).toBe(false);
    expect(hasProEdTerm('Pro Miami runners')).toBe(false);
    expect(hasProEdTerm('#thinspiration2026')).toBe(true);
    expect(hasProEdTerm('meanspos')).toBe(true);
    expect(hasProEdTerm(null)).toBe(false);
  });
});
