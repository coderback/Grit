import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import type { PoolClient } from 'pg';
import { from as copyFrom } from 'pg-copy-streams';
import {
  cleanRecord,
  RANK_SQL,
  type CleanRecord,
  type FoodRecord,
} from './record';

/**
 * Writes food records into GRIT's food database, idempotently:
 *
 * - a record is matched to its food by (source, externalId), then by
 *   barcode, so the same product from two sources is one food;
 * - the highest-ranked source's values are the ones shown (see rankOf);
 *   lower-ranked sources only add their barcodes, names and a source row;
 * - rows are only written when something changed, so importing the same
 *   data twice changes nothing.
 *
 * Each batch is copied into temporary tables with COPY and merged with a
 * few set-based statements, in one transaction.
 */

export interface WriteStats {
  read: number;
  skipped: number;
  foodsInserted: number;
  foodsUpdated: number;
  nutrientsChanged: number;
  servingsChanged: number;
  barcodesAdded: number;
  namesAdded: number;
  sourcesChanged: number;
  removed: number;
}

export const emptyStats = (): WriteStats => ({
  read: 0,
  skipped: 0,
  foodsInserted: 0,
  foodsUpdated: 0,
  nutrientsChanged: 0,
  servingsChanged: 0,
  barcodesAdded: 0,
  namesAdded: 0,
  sourcesChanged: 0,
  removed: 0,
});

/** True when a run changed anything. */
export const changedAnything = (s: WriteStats) =>
  s.foodsInserted +
    s.foodsUpdated +
    s.nutrientsChanged +
    s.servingsChanged +
    s.barcodesAdded +
    s.namesAdded +
    s.sourcesChanged +
    s.removed >
  0;

// ── COPY text format ─────────────────────────────────────────────────────────

function cell(v: unknown): string {
  if (v === null || v === undefined) return '\\N';
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) {
    const items = v.map((i) => `"${String(i).replace(/(["\\])/g, '\\$1')}"`);
    return cell(`{${items.join(',')}}`);
  }
  const text =
    typeof v === 'string'
      ? v
      : typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint'
        ? String(v)
        : JSON.stringify(v);
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\t/g, '\\t')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

async function copyRows(
  client: PoolClient,
  table: string,
  columns: string[],
  rows: unknown[][],
) {
  if (!rows.length) return;
  const stream = client.query(
    copyFrom(`COPY ${table} (${columns.join(', ')}) FROM STDIN`),
  );
  await pipeline(
    Readable.from(
      (function* () {
        for (const r of rows) yield r.map(cell).join('\t') + '\n';
      })(),
    ),
    stream,
  );
}

// ── Merge ────────────────────────────────────────────────────────────────────

const STAGE_SQL = `
CREATE TEMP TABLE s_food (
  stage_id int PRIMARY KEY, id text, food_id text, source text, external_id text,
  fetched_at timestamptz, name text, brand text, kind text, category text,
  ingredients text, countries text[], quality float8, verified boolean,
  search_text text, image_url text, rank int, owns boolean DEFAULT false
) ON COMMIT DROP;
CREATE TEMP TABLE s_barcode (stage_id int, code text) ON COMMIT DROP;
CREATE TEMP TABLE s_serving (stage_id int, label text, grams float8, typical boolean) ON COMMIT DROP;
CREATE TEMP TABLE s_nutrient (stage_id int, nutrient text, amount float8, basis text) ON COMMIT DROP;
CREATE TEMP TABLE s_name (stage_id int, name text, lang text) ON COMMIT DROP;
`;

const MERGE_SQL = {
  // 1. Known by source and id
  bySource: `
UPDATE s_food s SET food_id = fs."foodId"
FROM food_sources fs
WHERE fs.source = s.source AND fs."externalId" = s.external_id`,

  // 2. A food that already has one of its barcodes
  byBarcode: `
UPDATE s_food s SET food_id = m.food_id
FROM (
  SELECT DISTINCT ON (b.stage_id) b.stage_id, fb."foodId" AS food_id
  FROM s_barcode b JOIN food_barcodes fb ON fb.code = b.code
  ORDER BY b.stage_id, fb.code
) m
WHERE s.food_id IS NULL AND s.stage_id = m.stage_id`,

  // 3. Another new record in this batch with the same barcode: the
  // best-ranked one's food
  byBatchBarcode: `
UPDATE s_food s SET food_id = m.food_id
FROM (
  SELECT DISTINCT ON (b.stage_id) b.stage_id,
    first_value(f.id) OVER (PARTITION BY b.code ORDER BY f.rank DESC, f.stage_id) AS food_id
  FROM s_barcode b JOIN s_food f ON f.stage_id = b.stage_id
  WHERE f.food_id IS NULL
  ORDER BY b.stage_id, food_id
) m
WHERE s.food_id IS NULL AND s.stage_id = m.stage_id`,

  // 4. Otherwise a new food with the record's own id
  newFood: `UPDATE s_food SET food_id = id WHERE food_id IS NULL`,

  // Whose values a food shows: a new food's record, a record that outranks
  // the food's current source, or the record the food was created from.
  // Ties go to the food's own record, so re-runs never flip-flop.
  owners: `
UPDATE s_food s SET owns = true
FROM (
  SELECT DISTINCT ON (s2.food_id) s2.stage_id
  FROM s_food s2 LEFT JOIN foods f ON f.id = s2.food_id
  WHERE f.id IS NULL
     OR s2.rank > ${RANK_SQL('f')}
     OR (s2.rank = ${RANK_SQL('f')} AND f.id = s2.id)
  ORDER BY s2.food_id, s2.rank DESC, (s2.id = s2.food_id) DESC, s2.stage_id
) w
WHERE s.stage_id = w.stage_id`,

  foods: `
INSERT INTO foods (id, name, brand, kind, category, ingredients, countries,
  quality, verified, source, "searchText", "imageUrl", popularity, "updatedAt")
SELECT food_id, name, brand, kind, category, ingredients, countries,
  quality, verified, source, search_text, image_url, 0, now()
FROM s_food WHERE owns
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, brand = EXCLUDED.brand, kind = EXCLUDED.kind,
  category = EXCLUDED.category, ingredients = EXCLUDED.ingredients,
  countries = EXCLUDED.countries, quality = EXCLUDED.quality,
  verified = EXCLUDED.verified, source = EXCLUDED.source,
  "searchText" = EXCLUDED."searchText", "imageUrl" = EXCLUDED."imageUrl",
  "updatedAt" = now()
WHERE (foods.name, foods.brand, foods.kind, foods.category, foods.ingredients,
       foods.countries, foods.quality, foods.verified, foods.source,
       foods."searchText", foods."imageUrl")
  IS DISTINCT FROM
      (EXCLUDED.name, EXCLUDED.brand, EXCLUDED.kind, EXCLUDED.category,
       EXCLUDED.ingredients, EXCLUDED.countries, EXCLUDED.quality,
       EXCLUDED.verified, EXCLUDED.source, EXCLUDED."searchText",
       EXCLUDED."imageUrl")
RETURNING (xmax = 0) AS inserted`,

  // Values the source no longer gives (estimates from Phase 9 stay)
  dropNutrients: `
DELETE FROM food_nutrients n USING s_food s
WHERE s.owns AND n."foodId" = s.food_id AND n.basis <> 'estimated'
  AND NOT EXISTS (
    SELECT 1 FROM s_nutrient sn
    WHERE sn.stage_id = s.stage_id AND sn.nutrient = n.nutrient)`,

  nutrients: `
INSERT INTO food_nutrients ("foodId", nutrient, amount, basis)
SELECT s.food_id, sn.nutrient, sn.amount, sn.basis
FROM s_nutrient sn JOIN s_food s ON s.stage_id = sn.stage_id
WHERE s.owns
ON CONFLICT ("foodId", nutrient) DO UPDATE SET
  amount = EXCLUDED.amount, basis = EXCLUDED.basis, low = NULL, high = NULL
WHERE (food_nutrients.amount, food_nutrients.basis, food_nutrients.low, food_nutrients.high)
  IS DISTINCT FROM (EXCLUDED.amount, EXCLUDED.basis, NULL::float8, NULL::float8)`,

  dropServings: `
DELETE FROM food_servings v USING s_food s
WHERE s.owns AND v."foodId" = s.food_id
  AND NOT EXISTS (
    SELECT 1 FROM s_serving sv
    WHERE sv.stage_id = s.stage_id AND sv.label = v.label)`,

  servings: `
INSERT INTO food_servings (id, "foodId", label, grams, typical)
SELECT gen_random_uuid()::text, s.food_id, sv.label, sv.grams, sv.typical
FROM s_serving sv JOIN s_food s ON s.stage_id = sv.stage_id
WHERE s.owns
ON CONFLICT ("foodId", label) DO UPDATE SET
  grams = EXCLUDED.grams, typical = EXCLUDED.typical
WHERE (food_servings.grams, food_servings.typical)
  IS DISTINCT FROM (EXCLUDED.grams, EXCLUDED.typical)`,

  barcodes: `
INSERT INTO food_barcodes (code, "foodId")
SELECT DISTINCT ON (b.code) b.code, s.food_id
FROM s_barcode b JOIN s_food s ON s.stage_id = b.stage_id
ORDER BY b.code, s.rank DESC, s.stage_id
ON CONFLICT (code) DO NOTHING`,

  names: `
INSERT INTO food_names (id, "foodId", name, lang)
SELECT gen_random_uuid()::text, food_id, name, lang FROM (
  SELECT DISTINCT s.food_id, n.name, n.lang
  FROM s_name n JOIN s_food s ON s.stage_id = n.stage_id
) x
ON CONFLICT ("foodId", lang, name) DO NOTHING`,

  sources: `
INSERT INTO food_sources (id, "foodId", source, "externalId", "fetchedAt")
SELECT source || ':' || external_id, food_id, source, external_id, fetched_at
FROM s_food
ON CONFLICT (source, "externalId") DO UPDATE SET
  "foodId" = EXCLUDED."foodId", "fetchedAt" = EXCLUDED."fetchedAt"
WHERE (food_sources."foodId", food_sources."fetchedAt")
  IS DISTINCT FROM (EXCLUDED."foodId", EXCLUDED."fetchedAt")`,
};

/** Merges one batch of cleaned records. Runs inside the caller's transaction. */
async function mergeBatch(
  client: PoolClient,
  batch: CleanRecord[],
  stats: WriteStats,
) {
  await client.query(STAGE_SQL);

  const foods: unknown[][] = [];
  const barcodes: unknown[][] = [];
  const servings: unknown[][] = [];
  const nutrients: unknown[][] = [];
  const names: unknown[][] = [];
  batch.forEach((r, i) => {
    foods.push([
      i,
      r.id,
      r.source,
      r.externalId,
      r.fetchedAt,
      r.name,
      r.brand,
      r.kind,
      r.category,
      r.ingredients,
      r.countries,
      r.quality,
      r.verified,
      r.searchText,
      r.imageUrl,
      r.rank,
    ]);
    for (const code of r.barcodes) barcodes.push([i, code]);
    for (const s of r.servings) servings.push([i, s.label, s.grams, s.typical]);
    for (const [code, amount] of Object.entries(r.nutrients)) {
      nutrients.push([i, code, amount, r.basis]);
    }
    for (const n of r.names) names.push([i, n.name, n.lang]);
  });

  await copyRows(
    client,
    's_food',
    [
      'stage_id',
      'id',
      'source',
      'external_id',
      'fetched_at',
      'name',
      'brand',
      'kind',
      'category',
      'ingredients',
      'countries',
      'quality',
      'verified',
      'search_text',
      'image_url',
      'rank',
    ],
    foods,
  );
  await copyRows(client, 's_barcode', ['stage_id', 'code'], barcodes);
  await copyRows(
    client,
    's_serving',
    ['stage_id', 'label', 'grams', 'typical'],
    servings,
  );
  await copyRows(
    client,
    's_nutrient',
    ['stage_id', 'nutrient', 'amount', 'basis'],
    nutrients,
  );
  await copyRows(client, 's_name', ['stage_id', 'name', 'lang'], names);

  await client.query(MERGE_SQL.bySource);
  await client.query(MERGE_SQL.byBarcode);
  await client.query(MERGE_SQL.byBatchBarcode);
  await client.query(MERGE_SQL.newFood);
  await client.query(MERGE_SQL.owners);

  const upserted = await client.query<{ inserted: boolean }>(MERGE_SQL.foods);
  for (const row of upserted.rows) {
    if (row.inserted) stats.foodsInserted++;
    else stats.foodsUpdated++;
  }
  stats.nutrientsChanged +=
    (await client.query(MERGE_SQL.dropNutrients)).rowCount ?? 0;
  stats.nutrientsChanged +=
    (await client.query(MERGE_SQL.nutrients)).rowCount ?? 0;
  stats.servingsChanged +=
    (await client.query(MERGE_SQL.dropServings)).rowCount ?? 0;
  stats.servingsChanged +=
    (await client.query(MERGE_SQL.servings)).rowCount ?? 0;
  stats.barcodesAdded += (await client.query(MERGE_SQL.barcodes)).rowCount ?? 0;
  stats.namesAdded += (await client.query(MERGE_SQL.names)).rowCount ?? 0;
  stats.sourcesChanged += (await client.query(MERGE_SQL.sources)).rowCount ?? 0;
}

export interface WriteOptions {
  /** Records per transaction */
  batchSize?: number;
  /** Roll every batch back: see what would change without changing it */
  dryRun?: boolean;
  /** Called after each batch */
  onProgress?: (stats: WriteStats) => void;
  /**
   * Filled with the externalId of every record written (that passed
   * cleaning): what a full import passes to removeMissing.
   */
  seen?: Set<string>;
}

/**
 * Cleans and writes records, in batches. Records with the same source and
 * id are de-duplicated within a batch (the last one wins).
 */
export async function writeFoods(
  client: PoolClient,
  records: AsyncIterable<FoodRecord> | Iterable<FoodRecord>,
  options: WriteOptions = {},
): Promise<WriteStats> {
  const batchSize = options.batchSize ?? 2000;
  const stats = emptyStats();
  let batch = new Map<string, CleanRecord>();

  const flush = async () => {
    if (!batch.size) return;
    await client.query('BEGIN');
    try {
      await mergeBatch(client, [...batch.values()], stats);
      await client.query(options.dryRun ? 'ROLLBACK' : 'COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
    batch = new Map();
    options.onProgress?.(stats);
  };

  for await (const record of records) {
    stats.read++;
    const clean = cleanRecord(record);
    if (!clean) {
      stats.skipped++;
      continue;
    }
    batch.set(`${clean.source}:${clean.externalId}`, clean);
    options.seen?.add(clean.externalId);
    if (batch.size >= batchSize) await flush();
  }
  await flush();
  return stats;
}

export interface RemoveOptions {
  dryRun?: boolean;
  /**
   * Only this source's rows whose externalId starts with it: one dataset of
   * a source, e.g. "fndds:" of fdc, so a dataset's full import never
   * removes another dataset's rows.
   */
  prefix?: string;
  /** Fail (removing nothing) when more source rows than this would go */
  maxRemove?: number;
}

/**
 * Removes a source's rows that weren't in a full import (`seen`), and the
 * foods only that source described. For full re-imports only, never for
 * daily changes. Foods someone has logged keep their log; the log's
 * foodId is set to null.
 */
export async function removeMissing(
  client: PoolClient,
  source: string,
  seen: Set<string>,
  options: RemoveOptions = {},
): Promise<number> {
  return removeWhere(
    client,
    source,
    [...seen],
    'NOT EXISTS (SELECT 1 FROM s_ids s WHERE s.external_id = fs."externalId")',
    options,
  );
}

/**
 * Removes these rows of a source (products withdrawn from it), and the
 * foods no other source describes.
 */
export async function removeSources(
  client: PoolClient,
  source: string,
  externalIds: Iterable<string>,
  options: { dryRun?: boolean } = {},
): Promise<number> {
  const ids = [...new Set(externalIds)];
  if (!ids.length) return 0;
  return removeWhere(
    client,
    source,
    ids,
    'EXISTS (SELECT 1 FROM s_ids s WHERE s.external_id = fs."externalId")',
    options,
  );
}

async function removeWhere(
  client: PoolClient,
  source: string,
  ids: string[],
  match: string,
  options: RemoveOptions,
): Promise<number> {
  await client.query('BEGIN');
  try {
    await client.query(
      'CREATE TEMP TABLE s_ids (external_id text PRIMARY KEY) ON COMMIT DROP',
    );
    await copyRows(
      client,
      's_ids',
      ['external_id'],
      ids.map((id) => [id]),
    );
    const gone = await client.query<{ foodId: string }>(
      `DELETE FROM food_sources fs
       WHERE fs.source = $1
         AND starts_with(fs."externalId", $2)
         AND ${match}
       RETURNING fs."foodId"`,
      [source, options.prefix ?? ''],
    );
    const count = gone.rowCount ?? 0;
    if (options.maxRemove !== undefined && count > options.maxRemove) {
      throw new Error(
        `Refusing to remove ${count} ${source}${options.prefix ? ` ${options.prefix}` : ''} rows (the limit is ${options.maxRemove})`,
      );
    }
    const foodIds = [...new Set(gone.rows.map((r) => r.foodId))];
    // Foods no source describes any more
    const orphans = await client.query(
      `DELETE FROM foods f
       WHERE f.id = ANY($1::text[])
         AND NOT EXISTS (SELECT 1 FROM food_sources fs WHERE fs."foodId" = f.id)`,
      [foodIds],
    );
    await client.query(options.dryRun ? 'ROLLBACK' : 'COMMIT');
    return count + (orphans.rowCount ?? 0);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

/** A random id for rows the importers create outside a batch. */
export const newId = () => randomUUID();
