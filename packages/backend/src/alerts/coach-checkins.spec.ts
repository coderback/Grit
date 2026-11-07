import { addDays } from '../common/day';
import { NUTRIENTS, type NutrientCode } from '../food/nutrients';
import {
  NUTRIENT_IDEAS,
  checkInsFor,
  nutrientIdeas,
  type CheckInInput,
} from './coach-checkins';

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

  describe('nutrient_low', () => {
    // Judged days, newest first; `lowOn` lists which of them had low iron
    const days = (
      count: number,
      lowOn: number[],
      code: NutrientCode = 'iron_mg',
      percent = 40,
    ) =>
      Array.from({ length: count }, (_, i) => ({
        date: ago(i + 1),
        low: lowOn.includes(i) ? [code] : [],
        percent: lowOn.includes(i) ? { [code]: percent } : {},
      }));

    it('fires when the same nutrient is low on 5 of the last 7 judged days', () => {
      const [c] = checkInsFor({
        ...base,
        nutrientDays: days(7, [0, 1, 2, 4, 6]),
      });
      expect(c).toEqual({
        rule: 'nutrient_low',
        title: 'Iron has been running low',
        body: 'Iron was low on 5 of your last 7 logged days. Good sources include beef, lentils, beans, spinach or fortified cereal: adding one to a meal a day helps.',
        screen: 'food',
        nutrient: 'iron_mg',
      });
      // 5 of 5 is enough too
      expect(rules({ nutrientDays: days(5, [0, 1, 2, 3, 4]) })).toEqual([
        'nutrient_low',
      ]);
    });

    it('stays quiet at 4 of 7, with only 4 judged days, or with none', () => {
      expect(rules({ nutrientDays: days(7, [0, 1, 2, 3]) })).toEqual([]);
      expect(rules({ nutrientDays: days(4, [0, 1, 2, 3]) })).toEqual([]);
      expect(rules({ nutrientDays: [] })).toEqual([]);
      expect(rules({ nutrientDays: undefined })).toEqual([]);
      // Only the latest 7 count
      expect(rules({ nutrientDays: days(10, [0, 1, 2, 3, 7, 8, 9]) })).toEqual(
        [],
      );
    });

    it('needs the same nutrient on those days, and picks the most frequent', () => {
      // Calcium low on 5 days, iron on 6, fibre on 2
      const mixed = days(7, []).map((d, i) => ({
        ...d,
        low: (i < 5
          ? ['calcium_mg', 'iron_mg']
          : i === 5
            ? ['iron_mg', 'fibre_g']
            : ['fibre_g']) satisfies NutrientCode[],
      }));
      const [c] = checkInsFor({ ...base, nutrientDays: mixed });
      expect(c).toMatchObject({ rule: 'nutrient_low', nutrient: 'iron_mg' });
      expect(c.body).toContain('low on 6 of your last 7 logged days');
      expect(
        checkInsFor({ ...base, nutrientDays: mixed }).filter(
          (x) => x.rule === 'nutrient_low',
        ),
      ).toHaveLength(1);

      const spread = days(7, []).map((d, i) => ({
        ...d,
        low: [(['iron_mg', 'zinc_mg'] as const)[i % 2]] as NutrientCode[],
      }));
      expect(rules({ nutrientDays: spread })).toEqual([]);

      const vitD = days(7, [0, 1, 2, 3, 4, 5], 'vit_d_ug');
      const both = vitD.map((d, i) => ({
        ...d,
        low: i < 5 ? [...d.low, 'iron_mg' as const] : d.low,
      }));
      expect(checkInsFor({ ...base, nutrientDays: both })[0].nutrient).toBe(
        'vit_d_ug',
      );
    });

    it('breaks ties with the lower percent of target', () => {
      const tied = days(7, []).map((d, i) => ({
        ...d,
        low: (i < 5 ? ['zinc_mg', 'iron_mg'] : []) satisfies NutrientCode[],
        percent: { zinc_mg: 30, iron_mg: 50 },
      }));
      expect(checkInsFor({ ...base, nutrientDays: tied })[0].nutrient).toBe(
        'zinc_mg',
      );
    });

    it('never flags limits or numbers-only nutrients', () => {
      for (const code of ['sodium_mg', 'sat_fat_g', 'protein_g', 'kcal']) {
        expect(
          rules({
            nutrientDays: days(7, [0, 1, 2, 3, 4], code as NutrientCode),
          }),
        ).toEqual([]);
      }
    });

    it('suggests foods that fit the diet', () => {
      const low = days(7, [0, 1, 2, 3, 4]);
      const vegan = checkInsFor({
        ...base,
        nutrientDays: low,
        dietType: 'vegan',
      })[0];
      expect(vegan.body).toContain(
        'Good sources that fit your diet include lentils, beans, tofu',
      );
      expect(vegan.body).not.toContain('beef');
      const halal = checkInsFor({
        ...base,
        nutrientDays: days(7, [0, 1, 2, 3, 4], 'b12_ug'),
        dietType: 'halal_kosher',
      })[0];
      expect(halal.title).toBe('Vitamin B12 has been running low');
      expect(halal.body).toContain('that fit your diet');
      expect(halal.body).not.toMatch(/pork|shellfish|prawn|shrimp/i);
      expect(
        checkInsFor({ ...base, nutrientDays: low, dietType: 'none' })[0].body,
      ).not.toContain('fit your diet');
    });

    it('is skipped for anyone who asked not to hear about foods as good or bad', () => {
      expect(
        rules({ nutrientDays: days(7, [0, 1, 2, 3, 4]), edScreen: 'yes' }),
      ).toEqual([]);
      expect(
        rules({ nutrientDays: days(7, [0, 1, 2, 3, 4]), edScreen: 'no' }),
      ).toEqual(['nutrient_low']);
    });

    it('comes after protein and before a plateau', () => {
      const flat = [20, 17, 14, 10, 7, 3, 0].map((n, i) => ({
        date: ago(n),
        weightKg: 80 + (i % 2 ? 0.2 : -0.2),
      }));
      expect(
        rules({
          proteinByDay: [1, 2, 3, 4].map((n) => ({
            date: ago(n),
            proteinG: 90,
          })),
          nutrientDays: days(7, [0, 1, 2, 3, 4]),
          weights: flat,
        }),
      ).toEqual(['protein_low', 'nutrient_low', 'plateau']);
      // Other rules carry no nutrient
      expect(
        checkInsFor({ ...base, weights: flat }).every(
          (c) => c.nutrient === undefined,
        ),
      ).toBe(true);
    });

    it('never words anything as deficient or diagnostic', () => {
      for (const n of NUTRIENTS) {
        for (const dietType of [null, 'vegetarian', 'vegan', 'halal_kosher']) {
          for (const c of checkInsFor({
            ...base,
            dietType,
            nutrientDays: days(7, [0, 1, 2, 3, 4, 5, 6], n.code),
          })) {
            expect(`${c.title} ${c.body}`).not.toMatch(
              /deficien|diagnos|anaemi|anemi|supplement|menstrua/i,
            );
          }
        }
      }
    });
  });

  describe('nutrient food ideas', () => {
    const targets = NUTRIENTS.filter((n) => n.kind === 'target').map(
      (n) => n.code,
    );
    const ANIMAL =
      /\b(beef|chicken|pork|lamb|turkey|meat|fish|salmon|tuna|sardines?|liver|eggs?|yogurt|cheese|dairy|honey)\b|(?<!plant )\bmilk\b/i;
    const MEAT_OR_FISH =
      /\b(beef|chicken|pork|lamb|turkey|meat|fish|salmon|tuna|sardines?|liver|prawns?|shrimp)\b/i;
    const NOT_HALAL_KOSHER =
      /\b(pork|ham|bacon|gelatine?|shellfish|prawns?|shrimp|oysters?|clams?|mussels?|crab|lobster|scallops?)\b/i;

    it('has ideas for every target nutrient and none for the rest', () => {
      expect(Object.keys(NUTRIENT_IDEAS).sort()).toEqual([...targets].sort());
    });

    it('fits each diet', () => {
      for (const code of targets) {
        expect(nutrientIdeas(code, 'vegan')).not.toMatch(ANIMAL);
        expect(nutrientIdeas(code, 'vegetarian')).not.toMatch(MEAT_OR_FISH);
        expect(nutrientIdeas(code, 'halal_kosher')).not.toMatch(
          NOT_HALAL_KOSHER,
        );
        for (const diet of [null, 'none', 'vegan', 'unknown']) {
          expect(nutrientIdeas(code, diet)).not.toMatch(/supplement|pill/i);
        }
      }
      expect(nutrientIdeas('sodium_mg', null)).toBeNull();
    });
  });
});
