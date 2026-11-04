import { BadRequestException } from '@nestjs/common';
import { TestDb } from '../test-utils/db';
import { addDays, localToday } from '../common/day';
import { TrendsService } from './trends.service';
import { WeightService } from './weight.service';

describe('Weight and trends (database)', () => {
  const db = new TestDb();
  const weight = new WeightService(db.prisma);
  const trends = new TrendsService(db.prisma);
  const today = localToday(0);

  afterAll(() => db.cleanup());

  it('keeps one weigh-in a day and the profile on the latest', async () => {
    const u = await db.user();
    await db.prisma.user.update({
      where: { id: u.id },
      data: { goalWeightKg: 70 },
    });
    await weight.log(u.supabaseId, 80, 0, addDays(today, -10));
    await weight.log(u.supabaseId, 78.456, 0);
    await weight.log(u.supabaseId, 78, 0); // replaces today's
    // Back-filling an older day doesn't move the profile weight
    await weight.log(u.supabaseId, 81, 0, addDays(today, -20));

    const h = await weight.history(u.supabaseId, 90, 0);
    expect(h.entries.map((e) => e.weightKg)).toEqual([81, 80, 78]);
    expect(h).toMatchObject({
      latest: 78,
      change: -3,
      goalWeightKg: 70,
      toGoal: -8,
    });
    expect(
      (await db.prisma.user.findUnique({ where: { id: u.id } }))?.weightKg,
    ).toBe(78);

    // Deleting the latest falls back to the one before
    await weight.remove(u.supabaseId, h.entries[2].id);
    expect(
      (await db.prisma.user.findUnique({ where: { id: u.id } }))?.weightKg,
    ).toBe(80);
    expect((await weight.history(u.supabaseId, 30, 0)).entries).toHaveLength(2);
  });

  it('refuses future days and days over a year back', async () => {
    const u = await db.user();
    await expect(
      weight.log(u.supabaseId, 70, 0, addDays(today, 1)),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      weight.log(u.supabaseId, 70, 0, addDays(today, -400)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('totals each local day for the charts', async () => {
    const u = await db.user();
    const at = (date: string, hour: number) =>
      new Date(`${date}T${String(hour).padStart(2, '0')}:00:00Z`);
    const yesterday = addDays(today, -1);
    await db.prisma.foodLog.createMany({
      data: [
        {
          userId: u.id,
          name: 'A',
          mealType: 'lunch',
          calories: 500.4,
          proteinG: 30,
          loggedAt: at(yesterday, 12),
        },
        {
          userId: u.id,
          name: 'B',
          mealType: 'dinner',
          calories: 700,
          proteinG: 40.6,
          loggedAt: at(yesterday, 19),
        },
      ],
    });
    await db.prisma.activityLog.create({
      data: {
        userId: u.id,
        activityType: 'running',
        durationMin: 40,
        caloriesBurned: 400,
        loggedAt: at(yesterday, 7),
      },
    });
    await weight.log(u.supabaseId, 75, 0, yesterday);

    const t = await trends.trends(u.supabaseId, 7, 0);
    expect(t.days).toHaveLength(7);
    expect(t.days[6].date).toBe(today);
    expect(t.days[5]).toEqual({
      date: yesterday,
      calories: 1200,
      proteinG: 71,
      foodEntries: 2,
      activeMinutes: 40,
      caloriesBurned: 400,
      workouts: 1,
      weightKg: 75,
    });
    expect(t.days[6]).toMatchObject({
      calories: 0,
      foodEntries: 0,
      weightKg: null,
    });
    expect(t.goals).toMatchObject({ calories: 2000, activeMinutes: 60 });

    // In UTC-10, the 7am workout falls on the day before
    const west = await trends.trends(u.supabaseId, 30, -600);
    expect(
      west.days.find((d) => d.date === addDays(yesterday, -1))?.workouts,
    ).toBe(1);
  });
});
