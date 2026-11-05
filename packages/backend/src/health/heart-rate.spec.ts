import { heartRateKcal } from './heart-rate';
import { isCycleNote, planMemoryUpdate } from '../ai/coach-memory';

describe('heart-rate calories (Keytel et al., 2005)', () => {
  const man = { ageYears: 30, weightKg: 80, gender: 'male' };
  const woman = { ageYears: 30, weightKg: 60, gender: 'female' };

  it('uses the equation for each sex', () => {
    // (-55.0969 + 0.6309×140 + 0.1988×80 + 0.2017×30) / 4.184 = 13.19 kcal/min
    expect(heartRateKcal(140, 60, man)).toBe(791);
    // (-20.4022 + 0.4472×140 − 0.1263×60 + 0.074×30) / 4.184 = 8.81 kcal/min
    expect(heartRateKcal(140, 60, woman)).toBe(528);
    // Neither: the average of the two
    expect(heartRateKcal(140, 60, { ...man, gender: null })).toBe(
      Math.round(
        ((791 / 60 +
          (-20.4022 + 0.4472 * 140 - 0.1263 * 80 + 0.074 * 30) / 4.184) /
          2) *
          60,
      ),
    );
  });

  it("doesn't apply outside its range or without age and weight", () => {
    expect(heartRateKcal(85, 60, man)).toBeNull();
    expect(heartRateKcal(210, 60, man)).toBeNull();
    expect(heartRateKcal(140, 60, { ...man, ageYears: null })).toBeNull();
    expect(heartRateKcal(140, 60, { ...man, weightKg: null })).toBeNull();
  });
});

describe('cycle data and coach memory', () => {
  it('never keeps a note about the menstrual cycle', () => {
    expect(isCycleNote('Has painful periods')).toBe(true);
    expect(isCycleNote('Tracks her menstrual cycle')).toBe(true);
    expect(isCycleNote('Prefers short rest periods')).toBe(false);
    const { add } = planMemoryUpdate([], {
      add: ['Trains less during her period', 'Has a sore left knee'],
      remove: [],
    });
    expect(add).toEqual(['Has a sore left knee']);
  });
});
