import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { foodKey, recentFoods } from './quick-foods';
import type { SaveFavoriteDto } from './food.dto';

const RECENT_DAYS = 60;
const RECENT_LIMIT = 20;
const MAX_FAVORITES = 200;

@Injectable()
export class QuickFoodsService {
  constructor(private prisma: PrismaService) {}

  private async resolveUser(supabaseId: string) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /** Foods eaten in the last 60 days, most recent first, marked if saved. */
  async recent(supabaseId: string) {
    const user = await this.resolveUser(supabaseId);
    const since = new Date(Date.now() - RECENT_DAYS * 86_400_000);
    const [logs, favorites] = await Promise.all([
      this.prisma.foodLog.findMany({
        where: { userId: user.id, loggedAt: { gte: since, lte: new Date() } },
        orderBy: { loggedAt: 'desc' },
        take: 500,
        select: {
          name: true,
          brand: true,
          barcode: true,
          calories: true,
          proteinG: true,
          carbsG: true,
          fatG: true,
          servingQty: true,
          servingUnit: true,
          mealType: true,
          loggedAt: true,
        },
      }),
      this.prisma.favoriteFood.findMany({
        where: { userId: user.id },
        select: { id: true, key: true },
      }),
    ]);
    const favoriteIds = new Map(favorites.map((f) => [f.key, f.id]));
    return recentFoods(logs, RECENT_LIMIT).map((f) => ({
      ...f,
      favoriteId: favoriteIds.get(f.key) ?? null,
    }));
  }

  async favorites(supabaseId: string) {
    const user = await this.resolveUser(supabaseId);
    return this.prisma.favoriteFood.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: MAX_FAVORITES,
    });
  }

  /** Saves a portion as a favourite, replacing the saved portion of the same food. */
  async save(supabaseId: string, dto: SaveFavoriteDto) {
    const user = await this.resolveUser(supabaseId);
    const key = foodKey(dto.name, dto.brand);
    const data = {
      name: dto.name.trim(),
      brand: dto.brand?.trim() || null,
      barcode: dto.barcode || null,
      calories: dto.calories,
      proteinG: dto.proteinG ?? 0,
      carbsG: dto.carbsG ?? 0,
      fatG: dto.fatG ?? 0,
      servingQty: dto.servingQty ?? 1,
      servingUnit: dto.servingUnit ?? 'serving',
    };
    return this.prisma.favoriteFood.upsert({
      where: { userId_key: { userId: user.id, key } },
      update: data,
      create: { ...data, userId: user.id, key },
    });
  }

  async remove(supabaseId: string, id: string) {
    const user = await this.resolveUser(supabaseId);
    const { count } = await this.prisma.favoriteFood.deleteMany({
      where: { id, userId: user.id },
    });
    if (count === 0) throw new NotFoundException('Favourite not found');
    return { ok: true };
  }
}
