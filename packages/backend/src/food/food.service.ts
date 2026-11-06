import {
  BadGatewayException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import {
  addDays,
  dayRange,
  localDateOf,
  localToday,
  weekStart,
} from '../common/day';
import { calorieBudget, macroTargets } from '../common/nutrition';
import type {
  CreateFoodLogDto,
  SearchEventDto,
  UpdateFoodLogDto,
} from './food.dto';
import type { NormalizedFood, OFFProduct, SearchHit } from './food.types';
import { FoodDbService, MIN_QUERY_LENGTH } from './food-db.service';
import { normaliseBarcode } from './food-text';
import { isNutrientCode, type NutrientSnapshot } from './nutrients';
import { offRecord } from './off-product';

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

// The most results a search returns
const SEARCH_RESULTS = 25;

/**
 * Whether search also asks Open Food Facts live: "fallback" (the default)
 * when GRIT's database finds fewer than LIVE_BELOW results, or "off" once
 * the full Open Food Facts import is in. Barcode misses always ask live.
 */
const LIVE_BELOW = 5;
const liveSearchMode = () =>
  process.env.FOOD_LIVE_SEARCH === 'off' ? 'off' : 'fallback';

export interface SearchContext {
  supabaseId?: string;
  /** ISO 3166-1 alpha-2, e.g. "GB" */
  country?: string;
}

function toNumber(value: number | string | undefined): number | undefined {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return n !== undefined && Number.isFinite(n) ? n : undefined;
}

/**
 * Caffeine (labelled in grams) as mg, and alcohol (labelled as % vol) as
 * grams per 100 g, taking a drink's density as about 1 and ethanol's as 0.789.
 */
export function drinkValues(n: OFFProduct['nutriments'] = {}) {
  const caffeine = toNumber(n.caffeine_100g);
  const abv = toNumber(n.alcohol_100g);
  return {
    ...(caffeine !== undefined && caffeine >= 0 && caffeine < 5
      ? { caffeineMg: Math.round(caffeine * 1000) }
      : {}),
    ...(abv !== undefined && abv > 0 && abv <= 100
      ? { alcoholG: Math.round(abv * 0.789 * 10) / 10 }
      : {}),
  };
}

// Every FoodLog column but the nutrient snapshot
const LOG_FIELDS = {
  id: true,
  userId: true,
  name: true,
  brand: true,
  barcode: true,
  mealType: true,
  calories: true,
  proteinG: true,
  carbsG: true,
  fatG: true,
  servingQty: true,
  servingUnit: true,
  loggedAt: true,
  caffeineMg: true,
  alcoholG: true,
  corrected: true,
  foodId: true,
  grams: true,
} satisfies Prisma.FoodLogSelect;

/** new ÷ old calories when an edit really changed them, else null. */
export function calorieRatio(before: number, after: number | undefined) {
  if (after === undefined || !(before > 0) || Math.abs(after - before) <= 0.5) {
    return null;
  }
  return after / before;
}

/**
 * When a log's calories are edited, its nutrient snapshot scales with them
 * (usually the portion was different). Undefined leaves it unchanged.
 */
export function scaledSnapshot(
  snapshot: Prisma.JsonValue | null,
  before: number,
  after: number | undefined,
): Prisma.InputJsonValue | undefined {
  const ratio = calorieRatio(before, after);
  if (
    !ratio ||
    !snapshot ||
    typeof snapshot !== 'object' ||
    Array.isArray(snapshot)
  ) {
    return undefined;
  }
  const out: NutrientSnapshot = {};
  for (const [code, v] of Object.entries(snapshot)) {
    if (!isNutrientCode(code) || !v || typeof v !== 'object') continue;
    const { amount, basis } = v as { amount?: unknown; basis?: unknown };
    if (
      typeof amount !== 'number' ||
      (basis !== 'measured' && basis !== 'label')
    ) {
      continue;
    }
    out[code] = { amount: Number((amount * ratio).toPrecision(4)), basis };
  }
  return out;
}

@Injectable()
export class FoodService {
  private searchCache = new Map<
    string,
    { expiresAt: number; results: NormalizedFood[] }
  >();

  private readonly logger = new Logger(FoodService.name);
  private readonly db: FoodDbService;

  constructor(
    private prisma: PrismaService,
    @Optional() db?: FoodDbService,
  ) {
    this.db = db ?? new FoodDbService(prisma);
  }

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
      ...drinkValues(n),
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
      brands: Array.isArray(hit.brands) ? hit.brands[0] : hit.brands,
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

  /**
   * Food search: GRIT's own database first (the user's foods, then their
   * country's, then the best data), then Open Food Facts live while the
   * database is missing products (see FOOD_LIVE_SEARCH).
   */
  async searchFoods(
    query: string,
    ctx: SearchContext = {},
  ): Promise<NormalizedFood[]> {
    const terms = query.trim();
    if (terms.length < MIN_QUERY_LENGTH) return [];

    const userId = ctx.supabaseId
      ? await this.userIdOf(ctx.supabaseId)
      : undefined;
    let local: NormalizedFood[] = [];
    try {
      local = await this.db.search(terms, { userId, country: ctx.country });
    } catch (err) {
      // A slow or failed database search falls back to the live search
      this.logger.warn(`Food database search failed: ${String(err)}`);
    }
    if (local.length >= LIVE_BELOW || liveSearchMode() === 'off') {
      return local;
    }

    let live: NormalizedFood[];
    try {
      live = await this.searchLive(terms);
    } catch (err) {
      if (local.length) return local;
      throw err;
    }
    // Live results the database already has (same barcode) are left out
    const have = new Set(
      local.map((f) => normaliseBarcode(f.barcode)).filter(Boolean),
    );
    const extra = live.filter((f) => !have.has(normaliseBarcode(f.barcode)));
    return [...local, ...extra].slice(0, SEARCH_RESULTS);
  }

  /** Open Food Facts' own search, cached for 10 minutes. */
  async searchLive(query: string): Promise<NormalizedFood[]> {
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

    // Products with no calorie data would show as 0 kcal, so leave them out;
    // the user can still add the food manually
    const results = products
      .filter(
        (p) =>
          p.product_name &&
          (toNumber(p.nutriments?.['energy-kcal_100g']) ??
            toNumber(p.nutriments?.['energy-kcal'])) !== undefined,
      )
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

  /**
   * A barcode from GRIT's database, else from Open Food Facts live. A
   * product found live is saved, so the next scan is local. Every scan is
   * recorded, for the barcode hit rate by country.
   */
  async lookupBarcode(
    barcode: string,
    ctx: SearchContext = {},
  ): Promise<NormalizedFood> {
    let found: NormalizedFood | null = null;
    try {
      found = await this.lookupBarcodeOnce(barcode);
      return found;
    } finally {
      if (ctx.supabaseId) {
        void this.recordScan(ctx, barcode, !!found);
      }
    }
  }

  private async lookupBarcodeOnce(barcode: string): Promise<NormalizedFood> {
    try {
      const local = await this.db.byBarcode(barcode);
      if (local) return local;
    } catch (err) {
      this.logger.warn(`Food database barcode lookup failed: ${String(err)}`);
    }

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

    const product = { ...data.product, code: data.product.code || barcode };
    try {
      const record = offRecord(product);
      const saved = record ? await this.db.saveRecord(record) : null;
      if (saved) return saved;
    } catch (err) {
      this.logger.warn(`Couldn't save barcode ${barcode}: ${String(err)}`);
    }
    return this.normalize({ ...data.product, code: barcode });
  }

  private async recordScan(ctx: SearchContext, code: string, hit: boolean) {
    try {
      const userId = await this.userIdOf(ctx.supabaseId!);
      if (!userId) return;
      await this.prisma.searchEvent.create({
        data: {
          userId,
          kind: 'barcode',
          query: normaliseBarcode(code) ?? code,
          resultCount: hit ? 1 : 0,
          country: ctx.country ?? null,
        },
      });
    } catch (err) {
      this.logger.warn(`Couldn't record a barcode scan: ${String(err)}`);
    }
  }

  /** One database food, with its nutrients per 100 g. */
  async getFood(id: string): Promise<NormalizedFood> {
    const food = await this.db.byId(id);
    if (!food) throw new NotFoundException('Food not found');
    return food;
  }

  private async userIdOf(supabaseId: string) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId },
      select: { id: true },
    });
    return user?.id;
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
    const user = await this.prisma.user.findUnique({
      where: { supabaseId },
      select: { id: true, consentFoodData: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const userId = user.id;
    const link = await this.foodLink(dto);
    const log = await this.prisma.foodLog.create({
      data: {
        foodId: link.foodId,
        grams: link.grams,
        nutrients: link.nutrients ?? undefined,
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
        caffeineMg: dto.caffeineMg,
        alcoholG: dto.alcoholG,
        loggedAt: dto.loggedAt ? new Date(dto.loggedAt) : new Date(),
      },
    });
    // Popularity shapes everyone's search ranking, so it only counts logs
    // from people who chose to help improve GRIT's food data
    if (link.foodId && user.consentFoodData) {
      await this.db.countLog(link.foodId);
    }
    return log;
  }

  /**
   * The database food a log comes from and the grams eaten: the app's
   * foodId, else the barcode's food. With both, a snapshot of the amount's
   * nutrients, so later fixes to the food data don't change past days.
   */
  private async foodLink(dto: CreateFoodLogDto): Promise<{
    foodId: string | null;
    grams: number | null;
    nutrients: NutrientSnapshot | null;
  }> {
    const unit = dto.servingUnit?.trim().toLowerCase();
    const grams =
      dto.grams ??
      ((unit === 'g' || unit === 'ml') && dto.servingQty
        ? dto.servingQty
        : null);
    try {
      let foodId: string | null = null;
      if (dto.foodId && (await this.db.exists(dto.foodId))) {
        foodId = dto.foodId;
      } else if (!dto.foodId && dto.barcode && grams) {
        foodId = await this.db.idForBarcode(dto.barcode);
      }
      const nutrients =
        foodId && grams ? await this.db.snapshot(foodId, grams) : null;
      return { foodId, grams: grams ?? null, nutrients };
    } catch (err) {
      // Logging must not fail because the food database did
      this.logger.warn(`Couldn't link a log to its food: ${String(err)}`);
      return { foodId: null, grams: grams ?? null, nutrients: null };
    }
  }

  async getFoodLogsForDate(supabaseId: string, date: string, offset: number) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId },
      select: {
        id: true,
        calorieGoal: true,
        goalFocus: true,
        earnbackCalories: true,
        rolloverCalories: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const { start, end } = dayRange(date, offset);
    const yesterday = dayRange(addDays(date, -1), offset);

    const [logs, burned, eatenYesterday] = await Promise.all([
      this.prisma.foodLog.findMany({
        where: { userId: user.id, loggedAt: { gte: start, lt: end } },
        orderBy: { loggedAt: 'asc' },
        // Nutrient snapshots are for GET /nutrients/day, not every Food tab load
        select: LOG_FIELDS,
      }),
      user.earnbackCalories
        ? this.prisma.activityLog.aggregate({
            where: { userId: user.id, loggedAt: { gte: start, lt: end } },
            _sum: { caloriesBurned: true },
          })
        : null,
      user.rolloverCalories
        ? this.prisma.foodLog.aggregate({
            where: {
              userId: user.id,
              loggedAt: { gte: yesterday.start, lt: yesterday.end },
            },
            _sum: { calories: true },
            _count: true,
          })
        : null,
    ]);

    const totals = logs.reduce(
      (acc, log) => ({
        calories: acc.calories + log.calories,
        proteinG: acc.proteinG + log.proteinG,
        carbsG: acc.carbsG + log.carbsG,
        fatG: acc.fatG + log.fatG,
        caffeineMg: acc.caffeineMg + (log.caffeineMg ?? 0),
        alcoholG: acc.alcoholG + (log.alcoholG ?? 0),
      }),
      {
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        caffeineMg: 0,
        alcoholG: 0,
      },
    );

    const budget = calorieBudget({
      calorieGoal: user.calorieGoal,
      earnbackCalories: user.earnbackCalories,
      rolloverCalories: user.rolloverCalories,
      burnedToday: burned?._sum.caloriesBurned ?? 0,
      eatenYesterday: eatenYesterday?._count
        ? (eatenYesterday._sum.calories ?? 0)
        : null,
    });

    return {
      logs,
      totals,
      budget,
      // Macro targets scale with the day's full budget
      targets: macroTargets(budget.total, user.goalFocus),
    };
  }

  /** Calories and macros per day for the Mon–Sun week containing `date` (default: this week). */
  async getWeeklySummary(supabaseId: string, offset: number, date?: string) {
    const userId = await this.resolveUserId(supabaseId);
    const monday = weekStart(date ?? localToday(offset));
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

  async updateFoodLog(supabaseId: string, id: string, dto: UpdateFoodLogDto) {
    const userId = await this.resolveUserId(supabaseId);
    const before = await this.prisma.foodLog.findUnique({ where: { id } });
    if (!before || before.userId !== userId) {
      throw new NotFoundException('Food log not found');
    }
    // Changing the numbers of a picked food measures how often the food
    // data is wrong; renaming or moving it to another meal doesn't count
    const changed = (['calories', 'proteinG', 'carbsG', 'fatG'] as const).some(
      (k) => dto[k] !== undefined && Math.abs(dto[k] - before[k]) > 0.5,
    );
    // A calorie edit usually means a different portion: the snapshot and
    // the grams scale together, so logging it again from Recent matches
    const ratio = calorieRatio(before.calories, dto.calories);
    const grams =
      ratio && before.grams ? Math.round(before.grams * ratio * 10) / 10 : null;
    const gramPortion =
      before.grams != null &&
      before.servingQty === before.grams &&
      ['g', 'ml'].includes(before.servingUnit.trim().toLowerCase());
    return this.prisma.foodLog.update({
      where: { id },
      data: {
        ...dto,
        loggedAt: dto.loggedAt ? new Date(dto.loggedAt) : undefined,
        corrected: before.corrected || changed,
        nutrients: scaledSnapshot(
          before.nutrients,
          before.calories,
          dto.calories,
        ),
        ...(grams
          ? {
              grams,
              ...(gramPortion && dto.servingQty === undefined
                ? { servingQty: grams }
                : {}),
            }
          : {}),
      },
    });
  }

  /** Records what the user picked from a search (or that they picked nothing). */
  async recordSearch(supabaseId: string, dto: SearchEventDto) {
    const userId = await this.resolveUserId(supabaseId);
    await this.prisma.searchEvent.create({
      data: {
        userId,
        query: dto.query.trim().toLowerCase().slice(0, 200),
        position: dto.position ?? null,
        pickedName: dto.pickedName ?? null,
        pickedId: dto.pickedId ?? null,
        resultCount: dto.resultCount ?? null,
        country: dto.country ?? null,
        lang: dto.lang ?? null,
      },
    });
    return { ok: true };
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
