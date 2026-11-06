import { readdir, stat } from 'fs/promises';
import { basename, join } from 'path';
import { Readable } from 'stream';
import type { ReadableStream as WebReadableStream } from 'stream/web';
import { createGunzip } from 'zlib';
import type { Pool } from 'pg';
import { openArchive, type Archive } from './archive';
import { download, fetchText } from './download';
import type { FoodRecord } from './record';
import type { Job } from './run';
import {
  brandedRecords,
  FDC_DATASETS,
  FDC_DEFAULT_FILES,
  FDC_FILES_URL,
  FDC_INDEX_URL,
  fdcDatasetOf,
  fnddsRecords,
  latestFdcFiles,
  mergeNdbFoods,
  readFndds,
  readFoundation,
  readSrLegacy,
  releaseDateOf,
  type FdcDataset,
} from './sources/fdc';
import {
  offCsvDocs,
  offJsonlDocs,
  offRecords,
  onlyExisting,
  openFile,
  type OffCounts,
  type OffFilter,
} from './sources/off';
import { removeSources } from './writer';

type Log = (line: string) => void;

// ── USDA FoodData Central ────────────────────────────────────────────────────

function releaseOf(path: string): Date {
  const date = releaseDateOf(path);
  if (!date) {
    throw new Error(
      `Can't tell the release date of ${path}: keep USDA's file name, which ends in the date (…_2026-10-29.zip)`,
    );
  }
  return date;
}

async function withArchive<T>(path: string, fn: (a: Archive) => Promise<T>) {
  const archive = await openArchive(path);
  try {
    return await fn(archive);
  } finally {
    archive.close();
  }
}

/**
 * The import jobs for these FDC files. Foundation and SR Legacy are one
 * job, since they're merged into one record per NDB number; importing one
 * without the other would drop the other's values from those foods.
 */
export function fdcJobs(
  files: Partial<Record<FdcDataset, string>>,
  log: Log = () => {},
): Job[] {
  const jobs: Job[] = [];
  if (files.foundation || files.sr) {
    const { foundation, sr } = files;
    if (!foundation || !sr) {
      throw new Error(
        'Foundation and SR Legacy are imported together (one food per NDB number): give both',
      );
    }
    jobs.push({
      name: 'fdc foundation+sr',
      source: 'fdc',
      prefix: 'ndb:',
      complete: true,
      async *records() {
        const f = await withArchive(foundation, readFoundation);
        const s = await withArchive(sr, readSrLegacy);
        log(
          `Foundation: ${f.length} foods (${basename(foundation)}); SR Legacy: ${s.length} (${basename(sr)})`,
        );
        yield* mergeNdbFoods(f, s, {
          foundation: releaseOf(foundation),
          sr: releaseOf(sr),
        });
      },
    });
  }
  if (files.fndds) {
    const path = files.fndds;
    jobs.push({
      name: 'fdc fndds',
      source: 'fdc',
      prefix: 'fndds:',
      complete: true,
      async *records() {
        const foods = await withArchive(path, readFndds);
        log(`FNDDS: ${foods.length} foods (${basename(path)})`);
        yield* fnddsRecords(foods, releaseOf(path));
      },
    });
  }
  if (files.branded) {
    const path = files.branded;
    jobs.push({
      name: 'fdc branded',
      source: 'fdc',
      prefix: 'branded:',
      complete: true,
      async *records() {
        const archive = await openArchive(path);
        try {
          yield* brandedRecords(archive, { release: releaseOf(path), log });
        } finally {
          archive.close();
        }
      },
    });
  }
  return jobs;
}

/** The newest file or folder in `dir` for each dataset, by USDA's names. */
export async function fdcFilesIn(
  dir: string,
): Promise<Partial<Record<FdcDataset, string>>> {
  const out: Partial<Record<FdcDataset, string>> = {};
  const best: Partial<Record<FdcDataset, number>> = {};
  for (const name of await readdir(dir)) {
    if (name.endsWith('.part')) continue;
    const dataset = fdcDatasetOf(name);
    const date = releaseDateOf(name);
    if (!dataset || !date) continue;
    // Foundation's and FNDDS's CSV releases aren't read: their JSON is
    if ((dataset === 'foundation' || dataset === 'fndds') && /csv/i.test(name)) {
      continue;
    }
    if (dataset === 'sr' && /json/i.test(name)) continue;
    if (dataset === 'branded' && /json/i.test(name)) continue;
    if ((best[dataset] ?? -1) < date.getTime()) {
      best[dataset] = date.getTime();
      out[dataset] = join(dir, name);
    }
  }
  return out;
}

/**
 * The latest release of each dataset from USDA's download page (or the
 * releases known when this was written, if the page can't be read),
 * downloaded into the cache.
 */
export async function downloadFdc(
  datasets: FdcDataset[],
  options: { refresh?: boolean; log?: Log } = {},
): Promise<Partial<Record<FdcDataset, string>>> {
  let names: Partial<Record<FdcDataset, string>> = {};
  try {
    names = latestFdcFiles(await fetchText(FDC_INDEX_URL));
  } catch (err) {
    options.log?.(
      `Couldn't read USDA's download page (${(err as Error).message}); using the releases known on 2026-11-06`,
    );
  }
  const out: Partial<Record<FdcDataset, string>> = {};
  for (const dataset of datasets) {
    const name = names[dataset] ?? FDC_DEFAULT_FILES[dataset];
    out[dataset] = await download(FDC_FILES_URL + name, {
      refresh: options.refresh,
      log: options.log,
    });
  }
  return out;
}

export function parseFdcDatasets(value: string | undefined): FdcDataset[] {
  const wanted = (value ?? 'foundation,sr,fndds')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  for (const d of wanted) {
    if (!(FDC_DATASETS as readonly string[]).includes(d)) {
      throw new Error(
        `Unknown dataset "${d}": use ${FDC_DATASETS.join(', ')}`,
      );
    }
  }
  const set = new Set(wanted as FdcDataset[]);
  // One food per NDB: these two always go together
  if (set.has('foundation') || set.has('sr')) {
    set.add('foundation');
    set.add('sr');
  }
  return FDC_DATASETS.filter((d) => set.has(d));
}

// ── Open Food Facts ──────────────────────────────────────────────────────────

/** Whether a file is OFF's CSV export rather than JSON Lines. */
export function isOffCsv(path: string) {
  return /\.(csv|tsv)(\.gz)?$/i.test(path);
}

/** A remote file as a stream, decompressed, without keeping a copy. */
export async function streamUrl(url: string): Promise<Readable> {
  const res = await fetch(url, {
    headers: { 'user-agent': 'GRIT food-data importer/1.0 (support@gritapp.io)' },
  });
  if (!res.ok || !res.body) {
    throw new Error(`Couldn't fetch ${url}: HTTP ${res.status}`);
  }
  const body = Readable.fromWeb(res.body as WebReadableStream<Uint8Array>);
  if (!/\.gz$/i.test(new URL(url).pathname)) return body;
  const gunzip = createGunzip();
  body.once('error', (err) => gunzip.destroy(err));
  return body.pipe(gunzip);
}

export interface OffJobOptions extends OffFilter {
  /** A local file (JSONL or CSV, gzip or not), else a stream from `url` */
  file?: string;
  url?: string;
  /** Only update products already in the database */
  existingIn?: Pool;
  counts?: OffCounts;
  log?: Log;
}

/**
 * Products from a full export, or from delta files. Obsolete products are
 * skipped, and those already in the database lose their OFF row (and the
 * food, when nothing else describes it) once the records are written.
 */
export function offJob(
  name: string,
  inputs: (() => Promise<{ input: Readable; csv: boolean; label: string }>)[],
  options: OffJobOptions & { complete: boolean },
): Job {
  const obsolete = new Set<string>();
  const counts = options.counts ?? {
    docs: 0,
    obsolete: 0,
    notFood: 0,
    filtered: 0,
  };
  const filtered = !!(
    options.minScans ||
    options.countries?.length ||
    options.existingIn
  );
  return {
    name,
    source: 'off',
    prefix: '',
    complete: options.complete && !filtered,
    records() {
      async function* all(): AsyncGenerator<FoodRecord> {
        for (const open of inputs) {
          const { input, csv, label } = await open();
          options.log?.(`[${name}] reading ${label}`);
          const docs = csv ? offCsvDocs(input) : offJsonlDocs(input);
          yield* offRecords(
            docs,
            {
              ...options,
              mainNutrientsOnly: csv || options.mainNutrientsOnly,
              onObsolete: (code) => obsolete.add(code),
            },
            counts,
          );
        }
      }
      return options.existingIn ? onlyExisting(options.existingIn, all()) : all();
    },
    async finish(client, { dryRun }) {
      options.log?.(
        `[${name}] ${counts.docs.toLocaleString('en-US')} products: ${counts.obsolete} obsolete, ${counts.notFood} not imported (no barcode, supplements), ${counts.filtered} filtered out`,
      );
      return removeSources(client, 'off', obsolete, { dryRun });
    },
  };
}

/** A local OFF file as an input for offJob. */
export function offFileInput(path: string) {
  return () =>
    Promise.resolve({
      input: openFile(path),
      csv: isOffCsv(path),
      label: basename(path),
    });
}

/** Local delta files: a folder's openfoodfacts_products_*.json.gz, oldest first. */
export async function deltaFilesIn(path: string): Promise<string[]> {
  if (!(await stat(path)).isDirectory()) return [path];
  return (await readdir(path))
    .filter((n) => /^openfoodfacts_products_\d+_\d+\.json(\.gz)?$/.test(n))
    .sort()
    .map((n) => join(path, n));
}
