import {
  BadGatewayException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import {
  addDays,
  dayRange,
  localDateOf,
  localToday,
  weekStart,
} from '../common/day';
import type { CreateFoodLogDto } from './food.dto';
import type { NormalizedFood, OFFProduct, SearchHit } from './food.types';

// Open Food Facts asks every client to identify itself and can be slow, so
// requests carry a User-Agent and a timeout.
const OFF_HEADERS = { 'User-Agent': 'GRIT/1.0 (support@gritapp.io)' };

const off = axios.create({
  baseURL: 'https://world.openfoodfacts.org',
  timeout: 10_000,
  headers: OFF_HEADERS,
});

// search-a-licious is OFF's full-text search service. The legacy search.pl is
// heavily rate limited and often returns 503, so it is only the fallback.
const offSearch = axios.create({
  baseURL: 'https://search.openfoodfacts.org',
  timeout: 8_000,
  headers: OFF_HEADERS,
});

const SEARCH_PAGE_SIZE = 20;
const SEARCH_FIELDS =
  'code,product_name,brands,nutriments,serving_quantity,serving_quantity_unit,image_small_url';

// Repeat searches (typing, re-opening the sheet) are served from memory to
// stay well under OFF's rate limits.
const SEARCH_CACHE_TTL_MS = 10 * 60_000;
const SEARCH_CACHE_MAX = 500;

function toNumber(value: number | string | undefined): number | undefined {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return n !== undefined && Number.isFinite(n) ? n : undefined;
}

@Injectable()
export class FoodService {
  private searchCache = new Map<
    string,
    { expiresAt: number; results: NormalizedFood[] }
  >();

  constructor(private prisma: PrismaService) {}

  // ── Open Food Facts helpers ────────────────────────────────────────────────

  private normalize(product: OFFProduct): NormalizedFood {
    const n = product.nutriments ?? {};
    const servingQty = toNumber(product.serving_quantity);
    const hasServing = servingQty !== undefined && servingQty > 0;
    return {
      offId: product.id ?? product.code ?? '',
      name: product.product_name ?? 'Unknown product',
      brand: product.brands ?? null,
      barcode: product.code ?? null,
      calories:
        toNumber(n['energy-kcal_100g']) ?? toNumber(n['energy-kcal']) ?? 0,
      proteinG: toNumber(n.proteins_100g) ?? 0,
      carbsG: toNumber(n.carbohydrates_100g) ?? 0,
      fatG: toNumber(n.fat_100g) ?? 0,
      servingQty: hasServing ? servingQty : 100,
      servingUnit: product.serving_quantity_unit || 'g',
      imageUrl: product.image_small_url ?? null,
    };
  }

  /** search-a-licious takes Lucene syntax, so user input is reduced to plain words. */
  private async searchFullText(terms: string): Promise<OFFProduct[]> {
    // Lowercasing also stops words like AND/OR/NOT acting as operators
    const q = terms
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s']/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!q) return [];

    const { data } = await offSearch.get<{ hits?: SearchHit[] }>('/search', {
      params: { q, page_size: SEARCH_PAGE_SIZE, fields: SEARCH_FIELDS },
    });
    if (!Array.isArray(data.hits)) {
      throw new Error('Unexpected search response');
    }

    return data.hits.map((hit) => ({
      ...hit,
      brands: (Array.isArray(hit.brands) ? hit.brands[0] : hit.brands)
        // Taxonomy tags can carry a language prefix, e.g. "xx:ferrero"
        ?.replace(/^[a-z]{2}:/, ''),
    }));
  }

  private async searchLegacy(terms: string): Promise<OFFProduct[]> {
    const { data } = await off.get<{ products?: OFFProduct[] }>(
      '/cgi/search.pl',
      {
        params: {
          search_terms: terms,
          search_simple: 1,
          action: 'process',
          json: 1,
          page_size: SEARCH_PAGE_SIZE,
          fields: `id,${SEARCH_FIELDS}`,
        },
      },
    );
    return data.products ?? [];
  }

  async searchFoods(query: string): Promise<NormalizedFood[]> {
    const terms = query.trim();
    if (terms.length < 2) return [];

    const key = terms.toLowerCase();
    const cached = this.searchCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.results;

    let products: OFFProduct[];
    try {
      products = await this.searchFullText(terms);
    } catch {
      try {
        products = await this.searchLegacy(terms);
      } catch {
        throw new BadGatewayException('Food database is unavailable');
      }
    }

    const results = products
      .filter((p) => p.product_name)
      .map((p) => this.normalize(p));

    // Map keeps insertion order, so the first key is the oldest entry
    const oldest = this.searchCache.keys().next();
    if (this.searchCache.size >= SEARCH_CACHE_MAX && !oldest.done) {
      this.searchCache.delete(oldest.value);
    }
    this.searchCache.set(key, {
      expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
      results,
    });
    return results;
  }

  async lookupBarcode(barcode: string): Promise<NormalizedFood> {
    let data: { status: number; product?: OFFProduct };
    try {
      ({ data } = await off.get<{ status: number; product?: OFFProduct }>(
        `/api/v0/product/${barcode}.json`,
      ));
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        data = { status: 0 };
      } else {
        throw new BadGatewayException('Food database is unavailable');
      }
    }

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

  async logFood(supabaseId: string, dto: CreateFoodLogDto) {
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

  async getFoodLogsForDate(supabaseId: string, date: string, offset: number) {
    const userId = await this.resolveUserId(supabaseId);
    const { start, end } = dayRange(date, offset);

    const logs = await this.prisma.foodLog.findMany({
      where: { userId, loggedAt: { gte: start, lt: end } },
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

  /** Calories and macros per day for the user's current local week (Mon–Sun). */
  async getWeeklySummary(supabaseId: string, offset: number) {
    const userId = await this.resolveUserId(supabaseId);
    const monday = weekStart(localToday(offset));
    const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

    const logs = await this.prisma.foodLog.findMany({
      where: {
        userId,
        loggedAt: {
          gte: dayRange(monday, offset).start,
          lt: dayRange(days[6], offset).end,
        },
      },
      select: {
        loggedAt: true,
        calories: true,
        proteinG: true,
        carbsG: true,
        fatG: true,
      },
    });

    return {
      weekStart: monday,
      weekEnd: days[6],
      days: days.map((date) => {
        const dayLogs = logs.filter(
          (l) => localDateOf(l.loggedAt, offset) === date,
        );
        return {
          date,
          entries: dayLogs.length,
          calories: dayLogs.reduce((s, l) => s + l.calories, 0),
          proteinG: dayLogs.reduce((s, l) => s + l.proteinG, 0),
          carbsG: dayLogs.reduce((s, l) => s + l.carbsG, 0),
          fatG: dayLogs.reduce((s, l) => s + l.fatG, 0),
        };
      }),
    };
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
