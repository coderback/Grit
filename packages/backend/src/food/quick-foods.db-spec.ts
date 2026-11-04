import { NotFoundException } from '@nestjs/common';
import { TestDb } from '../test-utils/db';
import { QuickFoodsService } from './quick-foods.service';

describe('QuickFoodsService (database)', () => {
  const db = new TestDb();
  const quick = new QuickFoodsService(db.prisma);
  afterAll(() => db.cleanup());

  it('lists recent foods and marks favourites', async () => {
    const u = await db.user();
    const ago = (h: number) => new Date(Date.now() - h * 3_600_000);
    await db.prisma.foodLog.createMany({
      data: [
        {
          userId: u.id,
          name: 'Oats',
          mealType: 'breakfast',
          calories: 300,
          servingQty: 80,
          servingUnit: 'g',
          loggedAt: ago(30),
        },
        {
          userId: u.id,
          name: 'oats',
          mealType: 'breakfast',
          calories: 350,
          servingQty: 90,
          servingUnit: 'g',
          loggedAt: ago(5),
        },
        {
          userId: u.id,
          name: 'Wrap',
          brand: 'Tesco',
          mealType: 'lunch',
          calories: 450,
          loggedAt: ago(3),
        },
        // Too long ago to be recent
        {
          userId: u.id,
          name: 'Old soup',
          mealType: 'dinner',
          calories: 200,
          loggedAt: ago(24 * 70),
        },
      ],
    });
    const fav = await quick.save(u.supabaseId, {
      name: 'Wrap',
      brand: 'TESCO ',
      calories: 450,
    });

    const recent = await quick.recent(u.supabaseId);
    expect(recent.map((r) => [r.name, r.timesLogged, r.favoriteId])).toEqual([
      ['Wrap', 1, fav.id],
      ['oats', 2, null],
    ]);
    expect(recent[1]).toMatchObject({ calories: 350, servingQty: 90 });

    // Saving the same food again updates the saved portion
    await quick.save(u.supabaseId, {
      name: 'wrap',
      brand: 'Tesco',
      calories: 500,
    });
    const favs = await quick.favorites(u.supabaseId);
    expect(favs).toHaveLength(1);
    expect(favs[0].calories).toBe(500);

    await quick.remove(u.supabaseId, fav.id);
    expect(await quick.favorites(u.supabaseId)).toEqual([]);
    await expect(quick.remove(u.supabaseId, fav.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("can't remove someone else's favourite", async () => {
    const a = await db.user();
    const b = await db.user();
    const fav = await quick.save(a.supabaseId, { name: 'Mine', calories: 100 });
    await expect(quick.remove(b.supabaseId, fav.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
