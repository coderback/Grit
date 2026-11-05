import { TestDb } from '../test-utils/db';
import { localToday } from '../common/day';
import { FoodService } from './food.service';

describe('Food tracking data (database)', () => {
  const db = new TestDb();
  const food = new FoodService(db.prisma);
  afterAll(() => db.cleanup());

  it("adds up caffeine and alcohol in the day's totals", async () => {
    const u = await db.user();
    await food.logFood(u.supabaseId, {
      name: 'Filter coffee',
      mealType: 'breakfast',
      calories: 2,
      caffeineMg: 95,
    });
    await food.logFood(u.supabaseId, {
      name: 'Red wine',
      mealType: 'dinner',
      calories: 160,
      carbsG: 4,
      alcoholG: 17.9,
    });
    const day = await food.getFoodLogsForDate(u.supabaseId, localToday(0), 0);
    expect(day.totals).toMatchObject({
      calories: 162,
      caffeineMg: 95,
      alcoholG: 17.9,
    });
  });

  it('marks a log as corrected only when its numbers change', async () => {
    const u = await db.user();
    const log = await food.logFood(u.supabaseId, {
      name: 'Banana',
      mealType: 'snack',
      calories: 105,
      carbsG: 27,
    });
    const renamed = await food.updateFoodLog(u.supabaseId, log.id, {
      name: 'Ripe banana',
      mealType: 'breakfast',
      calories: 105.2,
    });
    expect(renamed.corrected).toBe(false);
    const fixed = await food.updateFoodLog(u.supabaseId, log.id, {
      calories: 89,
    });
    expect(fixed.corrected).toBe(true);
    // Stays corrected after later edits
    const again = await food.updateFoodLog(u.supabaseId, log.id, {
      name: 'Banana',
    });
    expect(again.corrected).toBe(true);
    const other = await db.user();
    await expect(
      food.updateFoodLog(other.supabaseId, log.id, { calories: 1 }),
    ).rejects.toThrow('Food log not found');
  });

  it('records what was picked from a search, or a miss', async () => {
    const u = await db.user();
    await food.recordSearch(u.supabaseId, {
      query: '  Jollof Rice ',
      position: 0,
      pickedName: 'Jollof rice',
      country: 'NG',
      lang: 'en-NG',
    });
    await food.recordSearch(u.supabaseId, { query: 'egusi', country: 'GB' });
    const events = await db.prisma.searchEvent.findMany({
      where: { userId: u.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(
      events.map((e) => [e.query, e.position, e.pickedName, e.country]),
    ).toEqual([
      ['jollof rice', 0, 'Jollof rice', 'NG'],
      ['egusi', null, null, 'GB'],
    ]);
  });
});
