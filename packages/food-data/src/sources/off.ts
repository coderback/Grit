import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import type { Readable } from 'stream';
import { createGunzip } from 'zlib';
import type { Pool } from 'pg';
import {
  isObsolete,
  offRecord,
  type OffProductDoc,
} from '../../../backend/src/food/off-product';
import { csvObjects } from '../csv';
import type { FoodRecord } from '../record';

/**
 * Open Food Facts (ODbL), through the one mapping the backend's barcode
 * lookup uses too (`offRecord`). Three inputs:
 *
 * - the JSONL export (openfoodfacts-products.jsonl.gz), the bulk path:
 *   schema 1004 documents, whose nutrients say whether they came from the
 *   label or from OFF's estimate from ingredients;
 * - the daily deltas, the same documents for products changed that day;
 * - the CSV export, which can't tell estimates from label values, so only
 *   the main label nutrients are read from it.
 */

export const OFF_JSONL_URL =
  'https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz';
export const OFF_CSV_URL =
  'https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz';
export const OFF_DELTA_URL = 'https://static.openfoodfacts.org/data/delta/';

/** A file as a stream, decompressed when its name ends in .gz. */
export function openFile(path: string): Readable {
  const file = createReadStream(path);
  if (!/\.gz$/i.test(path)) return file;
  const gunzip = createGunzip();
  file.once('error', (err) => gunzip.destroy(err));
  return file.pipe(gunzip);
}

export interface ReadStats {
  /** Lines or rows that weren't valid JSON */
  bad: number;
}

/** Product documents from JSON Lines (the JSONL export or a delta). */
export async function* offJsonlDocs(
  input: Readable,
  stats: ReadStats = { bad: 0 },
): AsyncGenerator<OffProductDoc> {
  const lines = createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    let doc: unknown;
    try {
      doc = JSON.parse(line);
    } catch {
      stats.bad++;
      continue;
    }
    if (doc && typeof doc === 'object') yield doc as OffProductDoc;
  }
}

// CSV columns read as they are; every "<key>_100g" column goes to nutriments
const CSV_FIELDS = [
  'code',
  'product_name',
  'generic_name',
  'brands',
  'categories_tags',
  'countries_tags',
  'ingredients_text',
  'serving_size',
  'serving_quantity',
  'unique_scans_n',
  'completeness',
  'states_tags',
  'data_quality_errors_tags',
  'last_modified_t',
  'main_category',
  'image_small_url',
] as const;

/** A CSV export row as a product document, with nutrients in `nutriments`. */
export function offCsvDoc(row: Record<string, string>): OffProductDoc {
  const doc: OffProductDoc = {};
  for (const field of CSV_FIELDS) {
    const v = row[field];
    if (v) doc[field] = v;
  }
  const nutriments: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value && key.endsWith('_100g')) nutriments[key] = value;
  }
  doc.nutriments = nutriments;
  return doc;
}

/**
 * Product documents from the CSV export: tab-separated and unquoted (a
 * stray quote is text).
 */
export async function* offCsvDocs(input: Readable): AsyncGenerator<OffProductDoc> {
  for await (const row of csvObjects(input, {
    delimiter: '\t',
    quote: false,
    relax_column_count: true,
  })) {
    yield offCsvDoc(row);
  }
}

export interface OffFilter {
  /** Only products scanned by at least this many people */
  minScans?: number;
  /** Only products sold in one of these (ISO alpha-2, lowercase) */
  countries?: string[];
  /** The CSV: read only main label nutrients (see offRecord) */
  mainNutrientsOnly?: boolean;
  /** Called with the code of each obsolete product, which isn't yielded */
  onObsolete?: (code: string) => void;
}

/** Counts of what a run read and left out. */
export interface OffCounts {
  docs: number;
  obsolete: number;
  notFood: number;
  filtered: number;
}

/** FoodRecords from product documents, filtered. */
export async function* offRecords(
  docs: AsyncIterable<OffProductDoc>,
  filter: OffFilter = {},
  counts: OffCounts = { docs: 0, obsolete: 0, notFood: 0, filtered: 0 },
): AsyncGenerator<FoodRecord> {
  const countries = filter.countries?.length ? new Set(filter.countries) : null;
  for await (const doc of docs) {
    counts.docs++;
    if (isObsolete(doc)) {
      counts.obsolete++;
      const code = (doc.code ?? '').trim();
      if (code) filter.onObsolete?.(code);
      continue;
    }
    if (filter.minScans) {
      const scans = Number(doc.unique_scans_n ?? 0);
      if (!(scans >= filter.minScans)) {
        counts.filtered++;
        continue;
      }
    }
    const record = offRecord(doc, {
      mainNutrientsOnly: filter.mainNutrientsOnly,
    });
    if (!record) {
      counts.notFood++;
      continue;
    }
    if (countries && !record.countries.some((c) => countries.has(c))) {
      counts.filtered++;
      continue;
    }
    yield record;
  }
}

// ── Daily deltas ─────────────────────────────────────────────────────────────

export interface DeltaFile {
  name: string;
  /** Unix seconds: the first and last change the file covers */
  from: number;
  to: number;
}

/** OFF's delta index (one file name per line, newest first), oldest first. */
export function parseDeltaIndex(text: string): DeltaFile[] {
  const files: DeltaFile[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = /^openfoodfacts_products_(\d+)_(\d+)\.json\.gz$/.exec(line.trim());
    if (m) files.push({ name: m[0], from: Number(m[1]), to: Number(m[2]) });
  }
  return files.sort((a, b) => a.from - b.from || a.to - b.to);
}

/** Delta files with changes after `since` (Unix seconds), oldest first. */
export function deltasSince(files: DeltaFile[], since: number): DeltaFile[] {
  return files.filter((f) => f.to > since);
}

/**
 * The newest change already imported from OFF: the latest fetchedAt (a
 * product's last_modified_t) among OFF's rows, in Unix seconds, or null
 * when there are none.
 */
export async function lastOffChange(pool: Pool): Promise<number | null> {
  const { rows } = await pool.query<{ t: string | null }>(
    `SELECT extract(epoch FROM max("fetchedAt"))::bigint::text AS t
     FROM food_sources WHERE source = 'off'`,
  );
  return rows[0]?.t ? Number(rows[0].t) : null;
}

/**
 * Only the records whose product is already in the database (an OFF row
 * with its code), looked up a batch at a time: for keeping a small
 * database current without growing it.
 */
export async function* onlyExisting(
  pool: Pool,
  records: AsyncIterable<FoodRecord>,
  batchSize = 1000,
): AsyncGenerator<FoodRecord> {
  let batch: FoodRecord[] = [];
  const flush = async function* () {
    if (!batch.length) return;
    const { rows } = await pool.query<{ externalId: string }>(
      `SELECT "externalId" FROM food_sources
       WHERE source = 'off' AND "externalId" = ANY($1::text[])`,
      [batch.map((r) => r.externalId)],
    );
    const known = new Set(rows.map((r) => r.externalId));
    const out = batch.filter((r) => known.has(r.externalId));
    batch = [];
    yield* out;
  };
  for await (const record of records) {
    batch.push(record);
    if (batch.length >= batchSize) yield* flush();
  }
  yield* flush();
}
