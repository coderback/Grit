import { NotFoundException } from '@nestjs/common';
import { TestDb } from '../test-utils/db';
import { addDays, dayRange, localToday, weekStart } from '../common/day';
import { NUTRIENTS, type NutrientCode } from '../food/nutrients';
import { NutrientsService } from './nutrients.service';

type Amounts = Partial<Record<NutrientCode, number>>;

const snapshot = (values: Amounts, basis = 'measured') =>
  Object.fromEntries(
    Object.entries(values).map(([code, amount]) => [code, { amount, basis }]),
  );

// A day logged entirely from foods with measured values
const KNOWN_DAY: [string, number, Amounts][] = [
  [
    'Porridge oats',
    300,
    {
      kcal: 300,
      protein_g: 10.5,
      iron_mg: 3.2,
      fibre_g: 8,
      magnesium_mg: 110,
      sat_fat_g: 1.2,
      sodium_mg: 5,
    },
  ],
  [
    'Lentil soup',
    400,
    {
      kcal: 400,
      protein_g: 22,
      iron_mg: 5.1,
      fibre_g: 12,
      folate_ug: 250,
      sodium_mg: 900,
      sat_fat_g: 0.8,
    },
  ],
  [
    'Spinach, raw',
    23,
    {
      kcal: 23,
      protein_g: 2.9,
      iron_mg: 2.7,
      vit_k_ug: 483,
      folate_ug: 194,
      vit_a_ug: 469,
    },
  ],
  [
    'Greek yogurt',
    146,
    {
      kcal: 146,
      protein_g: 20,
      calcium_mg: 200,
      b12_ug: 1.3,
      sat_fat_g: 4.4,
      sodium_mg: 65,
    },
  ],
  [
    'Chicken and rice',
    650,
    {
      kcal: 650,
      protein_g: 45,
      iron_mg: 1.9,
      sodium_mg: 780,
      sat_fat_g: 3.1,
      b12_ug: 0.6,
      fibre_g: 2.5,
    },
  ],
];

// Iron and fibre well under a woman's targets
const LOW_DAY: [string, number, Amounts][] = [
  ['White toast', 300, { kcal: 300, iron_mg: 1.0, fibre_g: 2.4 }],
  ['Cheddar', 400, { kcal: 400, iron_mg: 0.2, calcium_mg: 720 }],
  ['Pasta', 500, { kcal: 500, iron_mg: 1.5, fibre_g: 3 }],
];

describe('Nutrients (database)', () => {
  const db = new TestDb();
  const nutrients = new NutrientsService(db.prisma);
  afterAll(() => db.cleanup());

  async function woman() {
    const u = await db.user();
    await db.prisma.user.update({
      where: { id: u.id },
      data: {
        gender: 'female',
        dateOfBirth: new Date('1990-05-01T00:00:00Z'),
        calorieGoal: 2000,
      },
    });
    return u;
  }

  /** Logs foods on a local date, an hour apart from 8am. */
  async function logDay(
    userId: string,
    date: string,
    foods: [string, number, Amounts | null][],
    offset = 0,
  ) {
    const start = dayRange(date, offset).start.getTime();
    await db.prisma.foodLog.createMany({
      data: foods.map(([name, calories, values], i) => ({
        userId,
        name,
        mealType: 'lunch',
        calories,
        loggedAt: new Date(start + (8 + i) * 3_600_000),
        ...(values ? { nutrients: snapshot(values) } : {}),
      })),
    });
  }

  describe('GET /nutrients/day', () => {
    it('totals a day of known values to match a hand calculation', async () => {
      const u = await woman();
      await logDay(u.id, '2026-10-14', KNOWN_DAY);
      // Another day and another user don't leak in
      await logDay(u.id, '2026-10-15', LOW_DAY);
      await logDay((await woman()).id, '2026-10-14', LOW_DAY);

      const day = await nutrients.day(u.supabaseId, '2026-10-14', 0);
      expect(day).toMatchObject({
        date: '2026-10-14',
        calories: 1519, // 300 + 400 + 23 + 146 + 650
        entries: 5,
        coverage: 1,
        judged: true,
      });
      expect(day.nutrients.map((n) => n.code)).toEqual(
        NUTRIENTS.map((n) => n.code),
      );
      const by = Object.fromEntries(day.nutrients.map((n) => [n.code, n]));

      // Iron: 3.2 + 5.1 + 2.7 + 1.9 = 12.9 mg of an 18 mg target
      expect(by.iron_mg).toEqual({
        code: 'iron_mg',
        name: 'Iron',
        unit: 'mg',
        group: 'mineral',
        kind: 'target',
        amount: 13,
        target: 18,
        percent: 72,
        coverage: 0.9, // (300 + 400 + 23 + 650) / 1519
        status: 'ok',
        sources: [
          { name: 'Lentil soup', amount: 5.1 },
          { name: 'Porridge oats', amount: 3.2 },
        ],
      });
      // Every total against the hand sums
      const hand: Amounts = {
        kcal: 1519,
        protein_g: 100, // 100.4
        fibre_g: 23, // 22.5
        sodium_mg: 1750,
        sat_fat_g: 9.5,
        folate_ug: 444,
        b12_ug: 1.9,
        calcium_mg: 200,
        magnesium_mg: 110,
        vit_k_ug: 483,
        vit_a_ug: 469,
      };
      for (const n of day.nutrients) {
        expect([n.code, n.amount]).toEqual([
          n.code,
          hand[n.code] ?? (n.code === 'iron_mg' ? 13 : 0),
        ]);
      }

      // Limits: ok, against 2300 mg and 10% of 2000 kcal
      expect(by.sodium_mg).toMatchObject({
        kind: 'limit',
        target: 2300,
        percent: 76,
        status: 'ok',
      });
      expect(by.sat_fat_g).toMatchObject({ target: 22, status: 'ok' });
      // Numbers only
      expect(by.protein_g).toMatchObject({
        kind: 'none',
        target: null,
        percent: null,
        status: null,
      });
      // Folate is carried by only 28% of the calories: not judged
      expect(by.folate_ug).toMatchObject({
        coverage: 0.28,
        status: null,
        percent: 111,
      });
      // No data
      expect(by.vit_c_mg).toMatchObject({
        amount: 0,
        target: 75,
        percent: 0,
        coverage: 0,
        status: null,
        sources: [],
      });
    });

    it('calls things low or over only with enough data', async () => {
      const u = await woman();
      await logDay(u.id, '2026-10-12', [
        ['White toast', 300, { iron_mg: 1.0, fibre_g: 2.4, sodium_mg: 400 }],
        ['Cheddar', 400, { iron_mg: 0.2, calcium_mg: 720, sodium_mg: 650 }],
        ['Pasta', 500, { iron_mg: 1.5, fibre_g: 3, sodium_mg: 10 }],
        ['Instant ramen', 400, { sodium_mg: 1800 }],
      ]);
      const by = Object.fromEntries(
        (await nutrients.day(u.supabaseId, '2026-10-12', 0)).nutrients.map(
          (n) => [n.code, n],
        ),
      );
      expect(by.iron_mg).toMatchObject({ amount: 2.7, status: 'low' });
      // 400 of 1600 kcal: the ramen's label has no vitamins or minerals
      expect(by.iron_mg.coverage).toBe(0.75);
      expect(by.sodium_mg).toMatchObject({
        amount: 2860,
        coverage: 1,
        status: 'over',
      });
      // Only the cheese has calcium data: too little to judge
      expect(by.calcium_mg).toMatchObject({ coverage: 0.25, status: null });

      // A manual entry without data, an estimate and junk all read as no data
      const v = await woman();
      await logDay(v.id, '2026-10-12', [
        ['White toast', 300, { kcal: 300, iron_mg: 1.0 }],
        ['Homemade curry', 900, null],
      ]);
      await db.prisma.foodLog.createMany({
        data: [
          {
            userId: v.id,
            name: 'AI guess',
            mealType: 'dinner',
            calories: 500,
            loggedAt: new Date('2026-10-12T19:00:00Z'),
            nutrients: { iron_mg: { amount: 9, basis: 'estimated' } },
          },
          {
            userId: v.id,
            name: 'Broken',
            mealType: 'dinner',
            calories: 100,
            loggedAt: new Date('2026-10-12T20:00:00Z'),
            nutrients: ['iron_mg', 9],
          },
        ],
      });
      const day = await nutrients.day(v.supabaseId, '2026-10-12', 0);
      expect(day).toMatchObject({ entries: 4, coverage: 0.17, judged: true });
      expect(day.nutrients.find((n) => n.code === 'iron_mg')).toMatchObject({
        amount: 1,
        coverage: 0.17,
        status: null,
      });
    });

    it("doesn't judge a day that isn't logged fully enough", async () => {
      const u = await woman();
      await logDay(u.id, '2026-10-12', LOW_DAY.slice(0, 1));
      const day = await nutrients.day(u.supabaseId, '2026-10-12', 0);
      expect(day).toMatchObject({ entries: 1, coverage: 1, judged: false });
      expect(day.nutrients.every((n) => n.status === null)).toBe(true);
    });

    it("doesn't call anything low today, while it's still being logged, but shows a passed limit", async () => {
      const u = await woman();
      const today = localToday(0);
      await logDay(u.id, today, [
        ...LOW_DAY,
        ['Salted crisps', 500, { kcal: 500, sodium_mg: 2600 }],
      ]);
      const day = await nutrients.day(u.supabaseId, today, 0);
      expect(day).toMatchObject({ judged: false, inProgress: true });
      const status = (code: string) =>
        day.nutrients.find((n) => n.code === code)?.status;
      expect(status('iron_mg')).toBeNull();
      expect(status('sodium_mg')).toBe('over');
      // The same foods on a finished day are judged
      await logDay(u.id, '2026-10-12', LOW_DAY);
      const past = await nutrients.day(u.supabaseId, '2026-10-12', 0);
      expect(past).toMatchObject({ judged: true, inProgress: false });
      expect(past.nutrients.find((n) => n.code === 'iron_mg')?.status).toBe(
        'low',
      );
    });

    it("uses the user's local day", async () => {
      const u = await woman();
      // 23:30 UTC on the 13th is 00:30 on the 14th in UTC+1
      await db.prisma.foodLog.create({
        data: {
          userId: u.id,
          name: 'Late toast',
          mealType: 'snack',
          calories: 300,
          loggedAt: new Date('2026-10-13T23:30:00Z'),
          nutrients: snapshot({ iron_mg: 1 }),
        },
      });
      expect(
        (await nutrients.day(u.supabaseId, '2026-10-14', 60)).entries,
      ).toBe(1);
      expect((await nutrients.day(u.supabaseId, '2026-10-14', 0)).entries).toBe(
        0,
      );
    });

    it('uses the lower target without a recorded sex', async () => {
      const u = await db.user();
      const day = await nutrients.day(u.supabaseId, '2026-10-14', 0);
      expect(day).toMatchObject({ calories: 0, entries: 0, coverage: 0 });
      expect(day.nutrients.find((n) => n.code === 'iron_mg')?.target).toBe(8);
    });

    it('refuses an unknown user', async () => {
      await expect(
        nutrients.day('no-such-user', '2026-10-14', 0),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(nutrients.week('no-such-user', 0)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('GET /nutrients/week', () => {
    it('lists the nutrients low on most judged days of the week', async () => {
      const u = await woman();
      await logDay(u.id, '2026-10-12', LOW_DAY); // Mon
      await logDay(u.id, '2026-10-13', LOW_DAY);
      await logDay(u.id, '2026-10-14', KNOWN_DAY);
      await logDay(u.id, '2026-10-15', LOW_DAY);
      // Fri: one entry, not judged
      await logDay(u.id, '2026-10-16', LOW_DAY.slice(0, 1));
      // Sat: judged, but no nutrient data
      await logDay(u.id, '2026-10-17', [
        ['Takeaway', 900, null],
        ['Takeaway', 600, null],
      ]);
      // The weeks either side don't count
      await logDay(u.id, '2026-10-11', LOW_DAY);
      await logDay(u.id, '2026-10-19', LOW_DAY);

      const week = await nutrients.week(u.supabaseId, 0, '2026-10-15');
      expect(week).toEqual({
        weekStart: '2026-10-12',
        weekEnd: '2026-10-18',
        loggedDays: 6,
        judgedDays: 5,
        oftenLow: [
          // (15 + 15 + 72 + 15) / 4
          {
            code: 'iron_mg',
            name: 'Iron',
            unit: 'mg',
            target: 18,
            lowDays: 3,
            days: 4,
            avgPercent: 29,
          },
          // (22 + 22 + 90 + 22) / 4
          {
            code: 'fibre_g',
            name: 'Fibre',
            unit: 'g',
            target: 25,
            lowDays: 3,
            days: 4,
            avgPercent: 39,
          },
        ],
      });
      // Any date in the week gives the same week
      expect(await nutrients.week(u.supabaseId, 0, '2026-10-18')).toEqual(week);
    });

    it("needs three judged days, and doesn't judge today", async () => {
      const u = await woman();
      await logDay(u.id, '2026-10-12', LOW_DAY);
      await logDay(u.id, '2026-10-13', LOW_DAY);
      const week = await nutrients.week(u.supabaseId, 0, '2026-10-13');
      expect(week).toMatchObject({ judgedDays: 2, oftenLow: [] });

      const v = await woman();
      const today = localToday(0);
      await logDay(v.id, today, LOW_DAY, 0);
      expect(await nutrients.week(v.supabaseId, 0)).toEqual({
        weekStart: weekStart(today),
        weekEnd: addDays(weekStart(today), 6),
        loggedDays: 1,
        judgedDays: 0,
        oftenLow: [],
      });
    });
  });
});
