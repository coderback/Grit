import { Injectable, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import type { NormalizedFood, OFFProduct } from './food.types';

const OFF_BASE = 'https://world.openfoodfacts.org';

@Injectable()
export class FoodService {
  constructor(private prisma: PrismaService) {}

  // ── Open Food Facts helpers ────────────────────────────────────────────────

  private normalize(product: OFFProduct): NormalizedFood {
    const n = product.nutriments ?? {};
    return {
      offId: product.id ?? product.code ?? '',
      name: product.product_name ?? 'Unknown product',
      brand: product.brands ?? null,
      barcode: product.code ?? null,
      calories: n['energy-kcal_100g'] ?? n['energy-kcal'] ?? 0,
      proteinG: n.proteins_100g ?? 0,
      carbsG: n.carbohydrates_100g ?? 0,
      fatG: n.fat_100g ?? 0,
      servingQty: product.serving_quantity ?? 100,
      servingUnit: product.serving_quantity_unit ?? 'g',
      imageUrl: product.image_small_url ?? null,
    };
  }

  async searchFoods(query: string): Promise<NormalizedFood[]> {
    const { data } = await axios.get<{ products?: OFFProduct[] }>(
      `${OFF_BASE}/cgi/search.pl`,
      {
        params: {
          search_terms: query,
          search_simple: 1,
          action: 'process',
          json: 1,
          page_size: 20,
          fields:
            'id,code,product_name,brands,nutriments,serving_quantity,serving_quantity_unit,image_small_url',
        },
      },
    );
    return (data.products ?? [])
      .filter((p) => p.product_name)
      .map((p) => this.normalize(p));
  }

  async lookupBarcode(barcode: string): Promise<NormalizedFood> {
    const { data } = await axios.get<{
      status: number;
      product?: OFFProduct;
    }>(`${OFF_BASE}/api/v0/product/${barcode}.json`);

    if (data.status !== 1 || !data.product) {
      throw new NotFoundException(`No product found for barcode ${barcode}`);
    }

    return this.normalize({ ...data.product, code: barcode });
  }

  // ── User resolver ─────────────────────────────────────────────────────────

  private async resolveUserId(supabaseId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user.id;
  }

  // ── Food log CRUD ─────────────────────────────────────────────────────────

  async logFood(
    supabaseId: string,
    dto: {
      name: string;
      brand?: string;
      barcode?: string;
      mealType: string;
      calories: number;
      proteinG?: number;
      carbsG?: number;
      fatG?: number;
      servingQty?: number;
      servingUnit?: string;
      loggedAt?: string;
    },
  ) {
    const userId = await this.resolveUserId(supabaseId);
    return this.prisma.foodLog.create({
      data: {
        userId,
        name: dto.name,
        brand: dto.brand,
        barcode: dto.barcode,
        mealType: dto.mealType,
        calories: dto.calories,
        proteinG: dto.proteinG ?? 0,
        carbsG: dto.carbsG ?? 0,
        fatG: dto.fatG ?? 0,
        servingQty: dto.servingQty ?? 1,
        servingUnit: dto.servingUnit ?? 'serving',
        loggedAt: dto.loggedAt ? new Date(dto.loggedAt) : new Date(),
      },
    });
  }

  async getFoodLogsForDate(supabaseId: string, date: string) {
    const userId = await this.resolveUserId(supabaseId);
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const logs = await this.prisma.foodLog.findMany({
      where: { userId, loggedAt: { gte: start, lte: end } },
      orderBy: { loggedAt: 'asc' },
    });

    const totals = logs.reduce(
      (acc, log) => ({
        calories: acc.calories + log.calories,
        proteinG: acc.proteinG + log.proteinG,
        carbsG: acc.carbsG + log.carbsG,
        fatG: acc.fatG + log.fatG,
      }),
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    );

    return { logs, totals };
  }

  async deleteFoodLog(supabaseId: string, id: string) {
    const userId = await this.resolveUserId(supabaseId);
    const log = await this.prisma.foodLog.findUnique({ where: { id } });
    if (!log || log.userId !== userId) {
      throw new NotFoundException('Food log not found');
    }
    return this.prisma.foodLog.delete({ where: { id } });
  }
}
