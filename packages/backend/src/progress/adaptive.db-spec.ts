import { TestDb } from '../test-utils/db';
import { addDays, localToday } from '../common/day';
import { AdaptiveService } from './adaptive.service';
import { TrendsService } from './trends.service';
import { WeightService } from './weight.service';

describe('AdaptiveService (database)', () => {
  const db = new TestDb();
  const adaptive = new AdaptiveService(db.prisma, new TrendsService(db.prisma));
  const weight = new WeightService(db.prisma);
  const today = localToday(0);
  afterAll(() => db.cleanup());

  async function history(
    userId: string,
    supabaseId: string,
    days: number,
    kcal: number,
    kgPerDay: number,
  ) {
    for (let i = days; i >= 1; i--) {
      const date = addDays(today, -i);
      const at = (h: number) =>
        new Date(`${date}T${String(h).padStart(2, '0')}:00:00Z`);
      await db.prisma.foodLog.createMany({
        data: [
          {
            userId,
            name: 'Lunch',
            mealType: 'lunch',
            calories: kcal / 2,
            loggedAt: at(12),
          },
          {
            userId,
            name: 'Dinner',
            mealType: 'dinner',
            calories: kcal / 2,
            loggedAt: at(19),
          },
        ],
      });
      await weight.log(supabaseId, 85 + kgPerDay * (days - i), 0, date);
    }
  }

  it('shows progress until there is enough data', async () => {
    const u = await db.user();
    await history(u.id, u.supabaseId, 5, 2000, 0);
    const r = await adaptive.checkIn(u.supabaseId, 0);
    expect(r.estimate).toBeNull();
    expect(r.suggestion).toBeNull();
    expect(r.progress).toMatchObject({
      loggedDays: 5,
      weighIns: 5,
      needs: { loggedDays: 10, weighIns: 4, spanDays: 14 },
    });
  });

  it('estimates burn from intake and weight trend, and suggests a target once', async () => {
    const u = await db.user();
    await db.prisma.user.update({
      where: { id: u.id },
      data: {
        calorieGoal: 2000,
        primaryGoal: 'lose_weight',
        pace: 'moderate',
        gender: 'male',
        heightCm: 180,
        weightKg: 85,
        dateOfBirth: new Date('1990-01-01'),
        activityLevel: 'active',
      },
    });
    // Eating 2,000 and losing ~0.5 kg/week → burning about 2,550
    await history(u.id, u.supabaseId, 28, 2000, -0.5 / 7);

    const r = await adaptive.checkIn(u.supabaseId, 0);
    expect(r.estimate?.tdee).toBeGreaterThan(2400);
    expect(r.estimate?.tdee).toBeLessThan(2750);
    expect(r.estimate?.trendKgPerWeek).toBeLessThan(0);
    // Already losing at the chosen pace: the target barely needs to move
    expect(r.suggestion === null || Math.abs(r.suggestion.change) <= 200).toBe(
      true,
    );

    await adaptive.apply(u.supabaseId, 1900);
    const after = await adaptive.checkIn(u.supabaseId, 0);
    expect(after.suggestion).toBeNull(); // settling for a week
    expect(
      (await db.prisma.user.findUnique({ where: { id: u.id } }))?.calorieGoal,
    ).toBe(1900);
  });

  it('suggests more food when maintaining on too little, and can be put off', async () => {
    const u = await db.user();
    await db.prisma.user.update({
      where: { id: u.id },
      data: { calorieGoal: 1800, primaryGoal: 'maintain' },
    });
    // Eating 1,800 and losing 0.35 kg/week while meaning to maintain
    await history(u.id, u.supabaseId, 28, 1800, -0.05);
    const r = await adaptive.checkIn(u.supabaseId, 0);
    expect(r.suggestion?.change).toBeGreaterThan(0);
    expect(r.suggestion?.suggested).toBeLessThanOrEqual(2000);

    await adaptive.snooze(u.supabaseId);
    expect((await adaptive.checkIn(u.supabaseId, 0)).suggestion).toBeNull();
  });
});
