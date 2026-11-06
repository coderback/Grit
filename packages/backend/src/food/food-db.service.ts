import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { cleanRecord, round4, type FoodRecord } from './food-record';
import { barcodeCandidates, searchKey } from './food-text';
import type { NormalizedFood } from './food.types';
import {
  isNutrientCode,
  type NutrientBasis,
  type NutrientCode,
  type NutrientSnapshot,
} from './nutrients';

/**
 * GRIT's own food database (Phase 7): search, barcodes, single foods, saving
 * products found live, and the nutrients of a logged amount.
 *
 * Search is trigram-indexed substring matching on `foods.searchText` (each
 * query word must appear), ranked by: the user's own foods, foods from
 * their country, how closely the name matches, quality and popularity. When
 * the words don't all match (a typo, a different word order), it falls back
 * to trigram word similarity.
 */

export const MIN_QUERY_LENGTH = 3;
const SEARCH_LIMIT = 25;
// How long a search may take before it gives up (the app then sees fewer results)
const SEARCH_TIMEOUT_MS = 2500;
// Below this, the typo-tolerant search runs too
const ENOUGH_RESULTS = 5;
// How many personal foods (from Smart log's memory) lead the results
const MEMORY_RESULTS = 3;
// The most remembered foods looked through for them
const MEMORY_CANDIDATES = 500;
// Foods logged this recently count as the user's own
const MINE_DAYS = 180;

const MACRO_CODES: NutrientCode[] = [
  'kcal',
  'protein_g',
  'carbs_g',
  'fat_g',
  'caffeine_mg',
  'alcohol_g',
];

const FOOD_PARTS = {
  servings: true,
  nutrients: true,
  barcodes: { take: 1, orderBy: { code: 'asc' } },
} satisfies Prisma.FoodInclude;

type FoodWithParts = Prisma.FoodGetPayload<{ include: typeof FOOD_PARTS }>;

interface SearchRow {
  id: string;
  mine: boolean;
  score: number;
  wsim: number;
}

export interface SearchOptions {
  userId?: string;
  /** ISO 3166-1 alpha-2, any case */
  country?: string;
  /** Only these kinds of food */
  kinds?: string[];
  limit?: number;
}

/**
 * Words to match: plurals reduced to a stem that the singular also
 * contains ("eggs" → "egg", "tomatoes" → "tomato", "berries" → "berr").
 * Words under 3 letters can't use the trigram index and are left to the
 * ranking.
 */
export function queryWords(key: string): string[] {
  const stem = (w: string) => {
    if (w.length <= 3) return w;
    if (w.endsWith('ies')) return w.slice(0, -3);
    if (w.endsWith('oes')) return w.slice(0, -2);
    if (/(ches|shes|xes|sses)$/.test(w)) return w.slice(0, -2);
    if (w.endsWith('s') && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
    return w;
  };
  const words = key
    .split(' ')
    .map(stem)
    .filter((w) => w.length >= 3);
  return [...new Set(words)].slice(0, 6);
}

const likePattern = (w: string) => `%${w.replace(/[\\%_]/g, '\\$&')}%`;

@Injectable()
export class FoodDbService {
  private readonly logger = new Logger(FoodDbService.name);

  constructor(private prisma: PrismaService) {}

  // ── Search ────────────────────────────────────────────────────────────────

  async search(query: string, opts: SearchOptions = {}) {
    const key = searchKey(query);
    if (key.length < MIN_QUERY_LENGTH) return [];
    const limit = opts.limit ?? SEARCH_LIMIT;
    const words = queryWords(key);
    const country = opts.country?.toLowerCase() ?? '';

    // A ranking query that fails or runs out of time leaves fewer results,
    // never none: the exact matches and the user's memories still come back
    let rows: SearchRow[] = [];
    try {
      rows = await this.rank(key, words, country, opts, limit);
    } catch (err) {
      this.logger.warn(`Food search failed: ${String(err)}`);
    }
    if (rows.length < ENOUGH_RESULTS) {
      try {
        const fuzzy = await this.rank(key, null, country, opts, limit);
        const seen = new Set(rows.map((r) => r.id));
        rows = [...rows, ...fuzzy.filter((r) => !seen.has(r.id))]
          // The user's own foods first, whichever query found them (stable,
          // so exact matches still lead within each group)
          .sort((a, b) => Number(b.mine) - Number(a.mine))
          .slice(0, limit);
      } catch (err) {
        this.logger.warn(`Fuzzy food search failed: ${String(err)}`);
      }
    }

    const foods = await this.prisma.food.findMany({
      where: { id: { in: rows.map((r) => r.id) } },
      include: {
        servings: true,
        nutrients: { where: { nutrient: { in: MACRO_CODES } } },
        barcodes: { take: 1, orderBy: { code: 'asc' } },
      },
    });
    const byId = new Map(foods.map((f) => [f.id, f]));

    // The same food from two national tables reads the same: keep the better one
    const seenNames = new Set<string>();
    const results: NormalizedFood[] = [];
    for (const row of rows) {
      const food = byId.get(row.id);
      if (!food) continue;
      const nameKey = `${searchKey(food.name)}|${searchKey(food.brand ?? '')}`;
      if (seenNames.has(nameKey)) continue;
      seenNames.add(nameKey);
      results.push({ ...toNormalized(food, false), mine: row.mine });
    }

    if (opts.userId && !opts.kinds) {
      const memories = await this.memories(opts.userId, words, key);
      return [...memories, ...results].slice(0, limit);
    }
    return results;
  }

  /**
   * Ranked food ids. With `words`, every word must appear in the food's
   * search text (fast, index-backed); without, trigram word similarity
   * finds near misses.
   */
  private async rank(
    key: string,
    words: string[] | null,
    country: string,
    opts: SearchOptions,
    limit: number,
  ): Promise<SearchRow[]> {
    const match =
      words && words.length
        ? Prisma.join(
            words.map((w) => Prisma.sql`f."searchText" LIKE ${likePattern(w)}`),
            ' AND ',
          )
        : Prisma.sql`${key} OPERATOR(extensions.<%) f."searchText"`;
    const kinds = opts.kinds?.length
      ? Prisma.sql`AND f.kind IN (${Prisma.join(opts.kinds)})`
      : Prisma.empty;
    const mine = opts.userId
      ? Prisma.sql`
          SELECT "foodId" FROM food_logs
          WHERE "userId" = ${opts.userId} AND "foodId" IS NOT NULL
            AND "loggedAt" > ${new Date(Date.now() - MINE_DAYS * 86_400_000)}
          UNION SELECT "foodId" FROM food_memories
          WHERE "userId" = ${opts.userId} AND "foodId" IS NOT NULL
          UNION SELECT "foodId" FROM favorite_foods
          WHERE "userId" = ${opts.userId} AND "foodId" IS NOT NULL`
      : Prisma.sql`SELECT NULL::text AS "foodId" WHERE false`;

    const sql = Prisma.sql`
      WITH mine AS (${mine}),
      hits AS (
        SELECT f.id, f.kind, f.quality, f.popularity, f.countries, f."searchText"
        FROM foods f
        WHERE ${match} ${kinds}
      ),
      scored AS (
        SELECT h.id,
          h.id IN (SELECT "foodId" FROM mine) AS mine,
          extensions.word_similarity(${key}, h."searchText") AS wsim,
          extensions.similarity(${key}, h."searchText") AS sim,
          h."searchText" LIKE ${key + '%'} AS prefix,
          ${country} = ANY(h.countries) AS local,
          h.kind, h.quality, h.popularity
        FROM hits h
      )
      SELECT id, mine, wsim::float8 AS wsim,
        ((CASE WHEN mine THEN 1.0 ELSE 0 END)
         + (CASE WHEN local THEN 0.25 ELSE 0 END)
         + 0.5 * sim + 0.2 * wsim
         + (CASE WHEN prefix THEN 0.3 ELSE 0 END)
         + (CASE WHEN kind = 'generic' THEN 0.05 ELSE 0 END)
         + 0.2 * quality
         + 0.1 * least(1.0, ln(1 + popularity) / ln(101)))::float8 AS score
      FROM scored
      ORDER BY score DESC, id
      LIMIT ${limit * 2}`;

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('statement_timeout', ${String(SEARCH_TIMEOUT_MS)}, true)`;
      return tx.$queryRaw<SearchRow[]>(sql);
    });
  }

  /** The user's own remembered foods (Smart log) that match, without a database food. */
  private async memories(userId: string, words: string[], key: string) {
    const terms = words.length ? words : [key];
    // Matched on the name the same way foods are (accents dropped, plurals
    // stemmed); the stored memory key is normalised differently
    const candidates = await this.prisma.foodMemory.findMany({
      where: { userId, foodId: null },
      orderBy: [{ uses: 'desc' }, { updatedAt: 'desc' }],
      take: MEMORY_CANDIDATES,
    });
    const memories = candidates
      .filter((m) => {
        const name = searchKey(m.name);
        return terms.every((w) => name.includes(w));
      })
      .slice(0, MEMORY_RESULTS);
    return memories.map((m): NormalizedFood => ({
      offId: `memory:${m.id}`,
      name: m.name,
      brand: null,
      barcode: null,
      calories: m.kcalPer100g,
      proteinG: m.proteinPer100g,
      carbsG: m.carbsPer100g,
      fatG: m.fatPer100g,
      servingQty: Math.round(m.usualGrams),
      servingUnit: 'g',
      imageUrl: null,
      ...(m.caffeinePer100g != null ? { caffeineMg: m.caffeinePer100g } : {}),
      ...(m.alcoholPer100g != null ? { alcoholG: m.alcoholPer100g } : {}),
      kind: 'user',
      source: 'memory',
      servings: [
        { label: 'your usual', grams: Math.round(m.usualGrams), typical: true },
      ],
      mine: true,
    }));
  }

  // ── Single foods ──────────────────────────────────────────────────────────

  async byId(id: string) {
    const food = await this.prisma.food.findUnique({
      where: { id },
      include: FOOD_PARTS,
    });
    return food ? toNormalized(food, true) : null;
  }

  /** A scanned code, as written or (for 8 digits) as an expanded UPC-E. */
  async byBarcode(code: string) {
    const codes = barcodeCandidates(code);
    if (!codes.length) return null;
    const hits = await this.prisma.foodBarcode.findMany({
      where: { code: { in: codes } },
      include: { food: { include: FOOD_PARTS } },
    });
    // The code as written wins over the UPC-E reading
    const hit = codes.map((c) => hits.find((h) => h.code === c)).find(Boolean);
    return hit ? toNormalized(hit.food, true) : null;
  }

  /** The id of the database food with this barcode, if any. */
  async idForBarcode(code: string | null | undefined) {
    const codes = barcodeCandidates(code);
    if (!codes.length) return null;
    const hits = await this.prisma.foodBarcode.findMany({
      where: { code: { in: codes } },
      select: { code: true, foodId: true },
    });
    return (
      codes.map((c) => hits.find((h) => h.code === c)).find(Boolean)?.foodId ??
      null
    );
  }

  async exists(id: string) {
    const food = await this.prisma.food.findUnique({
      where: { id },
      select: { id: true },
    });
    return !!food;
  }

  /**
   * Saves a food found outside the database (a barcode looked up live), so
   * the next lookup is local. Returns null when it isn't worth keeping (no
   * name or calories). If another request saved it first, returns that.
   */
  async saveRecord(record: FoodRecord) {
    const clean = cleanRecord(record);
    if (!clean) return null;
    const existing = clean.barcodes.length
      ? await this.prisma.foodBarcode.findFirst({
          where: { code: { in: clean.barcodes } },
          select: { foodId: true },
        })
      : null;
    if (existing) return this.byId(existing.foodId);

    try {
      await this.prisma.food.create({
        data: {
          id: clean.id,
          name: clean.name,
          brand: clean.brand,
          kind: clean.kind,
          category: clean.category,
          ingredients: clean.ingredients,
          countries: clean.countries,
          quality: clean.quality,
          verified: clean.verified,
          source: clean.source,
          searchText: clean.searchText,
          imageUrl: clean.imageUrl,
          barcodes: { create: clean.barcodes.map((code) => ({ code })) },
          servings: { create: clean.servings },
          nutrients: {
            create: Object.entries(clean.nutrients).map(
              ([nutrient, amount]) => ({
                nutrient,
                amount,
                basis: clean.basis,
              }),
            ),
          },
          names: { create: clean.names },
          sources: {
            create: {
              id: `${clean.source}:${clean.externalId}`,
              source: clean.source,
              externalId: clean.externalId,
              fetchedAt: clean.fetchedAt,
            },
          },
        },
      });
    } catch (err) {
      // Saved by a parallel request, or by the importer, in the meantime
      if (
        !(err instanceof Prisma.PrismaClientKnownRequestError) ||
        err.code !== 'P2002'
      ) {
        throw err;
      }
      const again = clean.barcodes.length
        ? await this.prisma.foodBarcode.findFirst({
            where: { code: { in: clean.barcodes } },
            select: { foodId: true },
          })
        : null;
      return this.byId(again?.foodId ?? clean.id);
    }
    return this.byId(clean.id);
  }

  // ── Nutrients of an eaten amount ──────────────────────────────────────────

  /**
   * A logged amount's nutrients, from measured and label values only. Null
   * when the food has none.
   */
  async snapshot(
    foodId: string,
    grams: number,
  ): Promise<NutrientSnapshot | null> {
    if (!(grams > 0)) return null;
    const rows = await this.prisma.foodNutrient.findMany({
      where: { foodId, basis: { in: ['measured', 'label'] } },
      select: { nutrient: true, amount: true, basis: true },
    });
    const out: NutrientSnapshot = {};
    for (const r of rows) {
      if (!isNutrientCode(r.nutrient)) continue;
      out[r.nutrient] = {
        amount: round4((r.amount * grams) / 100),
        basis: r.basis as NutrientBasis,
      };
    }
    return Object.keys(out).length ? out : null;
  }

  /** Counts a log toward a food's popularity, which search ranking uses. */
  async countLog(foodId: string) {
    await this.prisma
      .$executeRaw`UPDATE foods SET popularity = popularity + 1 WHERE id = ${foodId}`.catch(
      (err: unknown) =>
        this.logger.warn(`Couldn't count a log for ${foodId}: ${String(err)}`),
    );
  }
}

/** A database food in the shape the app already reads, plus the Phase 7 fields. */
export function toNormalized(
  food: Pick<
    FoodWithParts,
    'id' | 'name' | 'brand' | 'kind' | 'source' | 'verified' | 'imageUrl'
  > & {
    servings: FoodWithParts['servings'];
    nutrients: FoodWithParts['nutrients'];
    barcodes: FoodWithParts['barcodes'];
  },
  withNutrients: boolean,
): NormalizedFood {
  const n = new Map(food.nutrients.map((x) => [x.nutrient, x]));
  const value = (code: NutrientCode) => n.get(code)?.amount;
  const servings = [...food.servings]
    .sort(
      (a, b) =>
        Number(b.typical) - Number(a.typical) ||
        a.grams - b.grams ||
        a.label.localeCompare(b.label),
    )
    .map((s) => ({ label: s.label, grams: s.grams, typical: s.typical }));
  const typical = servings.find((s) => s.typical);
  const basis = n.get('kcal')?.basis;
  const caffeine = value('caffeine_mg');
  const alcohol = value('alcohol_g');

  const out: NormalizedFood = {
    offId: food.id,
    name: food.name,
    brand: food.brand,
    barcode: food.barcodes[0]?.code ?? null,
    calories: value('kcal') ?? 0,
    proteinG: value('protein_g') ?? 0,
    carbsG: value('carbs_g') ?? 0,
    fatG: value('fat_g') ?? 0,
    servingQty: typical ? typical.grams : 100,
    servingUnit: 'g',
    imageUrl: food.imageUrl,
    ...(caffeine !== undefined ? { caffeineMg: caffeine } : {}),
    ...(alcohol !== undefined ? { alcoholG: alcohol } : {}),
    foodId: food.id,
    kind: food.kind as NormalizedFood['kind'],
    source: food.source,
    verified: food.verified,
    ...(basis === 'measured' || basis === 'label' ? { basis } : {}),
    servings,
  };
  if (withNutrients) {
    out.nutrients = Object.fromEntries(
      food.nutrients
        .filter(
          (x) =>
            isNutrientCode(x.nutrient) &&
            (x.basis === 'measured' || x.basis === 'label'),
        )
        .map((x) => [x.nutrient, x.amount]),
    );
  }
  return out;
}
