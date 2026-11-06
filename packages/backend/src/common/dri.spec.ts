import { SODIUM_LIMIT_MG, ageOn, driTargets, satFatLimitG } from './dri';
import { ageOn as safetyAgeOn } from './safety';
import { NUTRIENTS } from '../food/nutrients';

describe('driTargets', () => {
  it('has a target for every target nutrient and nothing else', () => {
    const targets = NUTRIENTS.filter((n) => n.kind === 'target')
      .map((n) => n.code)
      .sort();
    expect(Object.keys(driTargets({})).sort()).toEqual(targets);
  });

  it('matches the DRI tables for a few people', () => {
    const woman = driTargets({ gender: 'female', age: 30 });
    expect(woman.iron_mg).toBe(18);
    expect(driTargets({ gender: 'female', age: 50 }).iron_mg).toBe(18);
    expect(driTargets({ gender: 'female', age: 51 }).iron_mg).toBe(8);
    expect(woman.fibre_g).toBe(25);
    expect(woman.calcium_mg).toBe(1000);

    const older = driTargets({ gender: 'male', age: 51 });
    expect(older.b6_mg).toBe(1.7);
    expect(older.fibre_g).toBe(30);
    expect(driTargets({ gender: 'male', age: 50 }).b6_mg).toBe(1.3);

    // 18-year-olds use the 14–18 group
    expect(driTargets({ gender: 'male', age: 18 }).calcium_mg).toBe(1300);
    expect(driTargets({ gender: 'male', age: 19 }).calcium_mg).toBe(1000);
  });

  it('raises vitamin D for everyone from 71', () => {
    for (const gender of ['male', 'female', null]) {
      expect(driTargets({ gender, age: 70 }).vit_d_ug).toBe(15);
      expect(driTargets({ gender, age: 71 }).vit_d_ug).toBe(20);
    }
  });

  it('takes the lower value without a recorded sex, and adult values without an age', () => {
    const unknown = driTargets({ gender: 'other', age: 30 });
    expect(unknown.iron_mg).toBe(8); // male 8, female 18
    expect(unknown.magnesium_mg).toBe(310); // male 400, female 310
    expect(unknown.vit_c_mg).toBe(75); // male 90, female 75
    expect(driTargets({ gender: null, age: 30 })).toEqual(unknown);
    expect(driTargets({ gender: 'female' })).toEqual(
      driTargets({ gender: 'female', age: 19 }),
    );
  });
});

describe('limits', () => {
  it('has a sodium limit and a saturated-fat limit from calories', () => {
    expect(SODIUM_LIMIT_MG).toBe(2300);
    expect(satFatLimitG(2000)).toBe(22); // 10% of 2000 kcal at 9 kcal/g
    expect(satFatLimitG(1500)).toBe(17);
  });

  it('shares its age helper with the safety rules', () => {
    expect(ageOn).toBe(safetyAgeOn);
    const dob = new Date('1975-10-15T00:00:00Z');
    expect(ageOn(dob, new Date('2026-10-14T00:00:00Z'))).toBe(50);
    expect(ageOn(dob, new Date('2026-10-15T00:00:00Z'))).toBe(51);
  });
});
