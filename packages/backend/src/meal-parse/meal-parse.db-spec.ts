import type OpenAI from 'openai';
import { TestDb } from '../test-utils/db';
import { localToday } from '../common/day';
import type { FoodService } from '../food/food.service';
import { FoodDbService } from '../food/food-db.service';
import { searchTextOf } from '../food/food-text';
import { DAILY_PARSES, MealParseService } from './meal-parse.service';
import { memoryKey } from './meal-parse';

/** A model that always reads the same meal. */
function fakeModel(reply: unknown) {
  const calls: unknown[] = [];
  const client = {
    responses: {
      create: (req: unknown) => {
        calls.push(req);
        if (reply instanceof Error) return Promise.reject(reply);
        return Promise.resolve({ output_text: JSON.stringify(reply) });
      },
    },
  } as unknown as OpenAI;
  return { client, calls };
}

const item = (over: Record<string, unknown> = {}) => ({
  name: 'Porridge oats',
  brand: null,
  portion: '1 bowl',
  grams: 60,
  quantityStated: false,
  kcalPer100g: 380,
  proteinPer100g: 13,
  carbsPer100g: 60,
  fatPer100g: 7,
  caffeineMgPer100g: 0,
  alcoholGPer100g: 0,
  category: 'grains_bread',
  confidence: 'medium',
  ...over,
});

describe('MealParseService (database)', () => {
  const db = new TestDb();
  // Open Food Facts' live search, for branded items GRIT's database lacks
  const food = {
    searchLive: (q: string) =>
      Promise.resolve(
        q.toLowerCase().includes('fage')
          ? [
              { calories: 0 },
              { calories: 97, proteinG: 9, carbsG: 3.9, fatG: 5 },
            ]
          : [],
      ),
  } as unknown as FoodService;
  // An empty food database, so real data imported here can't change these tests
  const emptyDb = {
    search: () => Promise.resolve([]),
    exists: () => Promise.resolve(false),
    snapshot: () => Promise.resolve(null),
    countLog: () => Promise.resolve(),
  } as unknown as FoodDbService;
  afterAll(async () => {
    await db.prisma.food.deleteMany({
      where: { id: { startsWith: 'test_mp_' } },
    });
    await db.cleanup();
  });

  it('grounds items in memory, then the database, then the estimate', async () => {
    const u = await db.user();
    await db.prisma.foodMemory.create({
      data: {
        userId: u.id,
        key: memoryKey('Porridge oats'),
        name: 'Porridge oats',
        kcalPer100g: 370,
        proteinPer100g: 12,
        carbsPer100g: 62,
        fatPer100g: 8,
        usualGrams: 80,
      },
    });
    const { client, calls } = fakeModel({
      items: [
        item(),
        item({
          name: 'Greek yogurt',
          brand: 'Fage',
          grams: 150,
          quantityStated: true,
        }),
        // Calories that don't match the macros get corrected
        item({
          name: 'Honey',
          grams: 20,
          kcalPer100g: 50,
          proteinPer100g: 0,
          carbsPer100g: 80,
          fatPer100g: 0,
        }),
      ],
      question: 'Was the porridge made with milk or water?',
    });
    const meals = new MealParseService(
      db.prisma,
      food,
      client,
      'test',
      emptyDb,
    );
    const out = await meals.parse(
      u.supabaseId,
      { text: 'oats, fage yogurt and honey', imageBase64: 'aGVsbG8=' },
      0,
    );

    expect(out.items.map((i) => [i.name, i.source, i.grams])).toEqual([
      ['Porridge oats', 'memory', 80],
      ['Greek yogurt', 'database', 150],
      ['Honey', 'estimate', 20],
    ]);
    expect(out.items[0].calories).toBe(296); // 370 × 0.8
    expect(out.items[1].calories).toBe(146);
    expect(out.items[2].per100.kcal).toBe(320);
    expect(out.total.calories).toBe(296 + 146 + 64);
    expect(out.question).toMatch(/milk or water/);

    // The model is told the names of foods they've logged before
    expect((calls[0] as { instructions: string }).instructions).toContain(
      '"Porridge oats"',
    );
    // The photo went to the model as an image
    const req = calls[0] as {
      input: { content: { type: string; image_url?: string }[] }[];
    };
    expect(req.input[0].content[1]).toMatchObject({
      type: 'input_image',
      image_url: 'data:image/jpeg;base64,aGVsbG8=',
    });
  });

  it('matches plain foods to measured database foods, and logs their nutrients', async () => {
    // A made-up food, so real imported data can't interfere
    const seed = (id: string, name: string, kcal: number, iron: number) =>
      db.prisma.food.create({
        data: {
          id,
          name,
          kind: 'generic',
          source: 'fdc',
          countries: ['us'],
          verified: true,
          quality: 1,
          searchText: searchTextOf(name),
          nutrients: {
            create: [
              { nutrient: 'kcal', amount: kcal, basis: 'measured' },
              { nutrient: 'protein_g', amount: 2.5, basis: 'measured' },
              { nutrient: 'carbs_g', amount: 12, basis: 'measured' },
              { nutrient: 'fat_g', amount: 1.5, basis: 'measured' },
              { nutrient: 'iron_mg', amount: iron, basis: 'measured' },
            ],
          },
        },
      });
    await seed('test_mp_dry', 'Blorvak porridge oats, dry', 379, 4.2);
    await seed(
      'test_mp_cooked',
      'Blorvak porridge, cooked with water',
      71,
      0.9,
    );

    const u = await db.user();
    const reading = {
      items: [
        item({
          name: 'blorvak porridge',
          grams: 250,
          quantityStated: true,
          kcalPer100g: 75,
          proteinPer100g: 2.6,
          carbsPer100g: 12.5,
          fatPer100g: 1.6,
        }),
        // Nothing in the database has these words
        item({ name: 'zzqx sprinkles', grams: 5 }),
      ],
      question: null,
    };
    const meals = new MealParseService(
      db.prisma,
      food,
      fakeModel(reading).client,
      'test',
      new FoodDbService(db.prisma),
    );
    const out = await meals.parse(u.supabaseId, { text: 'porridge' }, 0);
    // The cooked porridge, not the dry oats: its calories match the reading's
    expect(out.items[0]).toMatchObject({
      source: 'database',
      foodId: 'test_mp_cooked',
      basis: 'measured',
      verified: true,
      per100: { kcal: 71 },
    });
    expect(out.items[1]).toMatchObject({ source: 'estimate' });
    expect(out.items[1]).not.toHaveProperty('foodId');

    await meals.log(u.supabaseId, {
      mealType: 'breakfast',
      items: [
        {
          name: 'blorvak porridge',
          foodId: 'test_mp_cooked',
          grams: 250,
          kcalPer100g: 71,
          proteinPer100g: 2.5,
          carbsPer100g: 12,
          fatPer100g: 1.5,
        },
      ],
    });
    const [log] = await db.prisma.foodLog.findMany({ where: { userId: u.id } });
    expect(log).toMatchObject({ foodId: 'test_mp_cooked', grams: 250 });
    expect(log.nutrients).toMatchObject({
      iron_mg: { amount: 2.25, basis: 'measured' },
      kcal: { amount: 177.5, basis: 'measured' },
    });

    // Remembered with its food, so the next reading keeps the link
    const again = await meals.parse(u.supabaseId, { text: 'porridge' }, 0);
    expect(again.items[0]).toMatchObject({
      source: 'memory',
      foodId: 'test_mp_cooked',
    });
  });

  it('logs confirmed items in grams and learns them', async () => {
    const u = await db.user();
    const meals = new MealParseService(
      db.prisma,
      food,
      fakeModel({ items: [], question: null }).client,
      'test',
    );
    const confirmed = {
      name: 'Chicken Breast',
      grams: 180,
      kcalPer100g: 165,
      proteinPer100g: 31,
      carbsPer100g: 0,
      fatPer100g: 3.6,
    };
    const res = await meals.log(u.supabaseId, {
      mealType: 'dinner',
      items: [
        confirmed,
        {
          ...confirmed,
          name: 'Ketchup',
          grams: 15,
          kcalPer100g: 100,
          proteinPer100g: 1,
          carbsPer100g: 25,
          fatPer100g: 0,
          remember: false,
        },
      ],
    });
    expect(res.logged).toBe(2);
    const logs = await db.prisma.foodLog.findMany({
      where: { userId: u.id },
      orderBy: { calories: 'desc' },
    });
    expect(
      logs.map((l) => [
        l.name,
        l.calories,
        l.proteinG,
        l.servingQty,
        l.servingUnit,
      ]),
    ).toEqual([
      ['Chicken Breast', 297, 55.8, 180, 'g'],
      ['Ketchup', 15, 0.2, 15, 'g'],
    ]);

    // Logged again with a new portion: one memory, updated
    await meals.log(u.supabaseId, {
      mealType: 'lunch',
      items: [{ ...confirmed, name: 'chicken breast!', grams: 200 }],
    });
    const memories = await meals.listMemories(u.supabaseId);
    expect(memories.map((m) => [m.key, m.usualGrams, m.uses])).toEqual([
      ['chicken breast', 200, 2],
    ]);

    await meals.forget(u.supabaseId, memories[0].id);
    expect(await meals.listMemories(u.supabaseId)).toEqual([]);
    const other = await db.user();
    await expect(
      meals.forget(other.supabaseId, memories[0].id),
    ).rejects.toThrow('Food not found');
  });

  it('caps readings per day, and a failed reading does not count', async () => {
    const u = await db.user();
    const failing = new MealParseService(
      db.prisma,
      food,
      fakeModel(new Error('down')).client,
      'test',
    );
    await expect(
      failing.parse(u.supabaseId, { text: 'toast' }, 0),
    ).rejects.toThrow("Couldn't read that meal");
    let row = await db.prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect([row.aiParseDay, row.aiParseCount]).toEqual([localToday(0), 0]);

    const meals = new MealParseService(
      db.prisma,
      food,
      fakeModel({ items: [item()], question: null }).client,
      'test',
    );
    await db.prisma.user.update({
      where: { id: u.id },
      data: { aiParseCount: DAILY_PARSES - 2 },
    });
    // Three at once with two left: exactly one is refused
    const results = await Promise.allSettled(
      [1, 2, 3].map(() => meals.parse(u.supabaseId, { text: 'oats' }, 0)),
    );
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    row = await db.prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(row.aiParseCount).toBe(DAILY_PARSES);

    // A new day starts again
    await db.prisma.user.update({
      where: { id: u.id },
      data: { aiParseDay: '2000-01-01' },
    });
    await expect(
      meals.parse(u.supabaseId, { text: 'oats' }, 0),
    ).resolves.toHaveProperty('items');
  });

  it('needs text or a photo', async () => {
    const u = await db.user();
    const meals = new MealParseService(
      db.prisma,
      food,
      fakeModel({ items: [], question: null }).client,
      'test',
    );
    await expect(meals.parse(u.supabaseId, { text: '  ' }, 0)).rejects.toThrow(
      'Describe the meal',
    );
  });
});
