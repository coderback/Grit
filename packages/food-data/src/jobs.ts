import { readdir, stat } from 'fs/promises';
import { basename, join } from 'path';
import { Readable } from 'stream';
import type { ReadableStream as WebReadableStream } from 'stream/web';
import { createGunzip } from 'zlib';
import type { Pool } from 'pg';
import { openArchive, openFiles, type Archive } from './archive';
import { checkSha256, download, fetchText } from './download';
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
import {
  cofidRecords,
  COFID_FILE,
  COFID_SHA256,
  COFID_URL,
  readCofidWorkbook,
} from './sources/cofid';
import { ciqualRecords, CIQUAL_FILES } from './sources/ciqual';
import { cnfRecords, CNF_FILE, CNF_SHA256 } from './sources/cnf';
import { fineliRecords, FINELI_FILE, FINELI_SHA256 } from './sources/fineli';
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
    if (
      (dataset === 'foundation' || dataset === 'fndds') &&
      /csv/i.test(name)
    ) {
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
      throw new Error(`Unknown dataset "${d}": use ${FDC_DATASETS.join(', ')}`);
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
    headers: {
      'user-agent': 'GRIT food-data importer/1.0 (support@gritapp.io)',
    },
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
  const unreadable = { bad: 0 };
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
          const docs = csv
            ? offCsvDocs(input)
            : offJsonlDocs(input, unreadable);
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
      return options.existingIn
        ? onlyExisting(options.existingIn, all())
        : all();
    },
    async finish(client, { dryRun }) {
      options.log?.(
        `[${name}] ${counts.docs.toLocaleString('en-US')} products: ${counts.obsolete} obsolete, ${counts.notFood} not imported (no barcode, supplements), ${counts.filtered} filtered out, ${unreadable.bad} unreadable lines`,
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

// ── UK CoFID ─────────────────────────────────────────────────────────────────

/** CoFID 2021 from a local workbook, else downloaded (and checked). */
export async function cofidFile(
  options: { file?: string; dir?: string; refresh?: boolean; log?: Log } = {},
): Promise<string> {
  if (options.file) return options.file;
  if (options.dir) {
    const name = (await readdir(options.dir)).find(
      (n) =>
        /composition_of_foods_integrated_dataset/i.test(n) &&
        /\.xlsx$/i.test(n),
    );
    if (!name) throw new Error(`No CoFID workbook in ${options.dir}`);
    return join(options.dir, name);
  }
  return download(COFID_URL, {
    name: COFID_FILE,
    sha256: COFID_SHA256,
    refresh: options.refresh,
    log: options.log,
  });
}

export function cofidJob(path: string, log: Log = () => {}): Job {
  return {
    name: 'cofid',
    source: 'cofid',
    prefix: '',
    complete: true,
    async *records() {
      const records = cofidRecords(await readCofidWorkbook(path));
      log(`CoFID: ${records.length} foods (${basename(path)})`);
      yield* records;
    },
  };
}

// ── National tables kept in this package: Canada's CNF, Finland's Fineli ────

/** Where the release files that can't be downloaded by a server are kept */
export const DATA_DIR = join(__dirname, '..', 'data');

/**
 * A national table's release file: --file as given, else the copy kept in
 * data/, checked against the SHA-256 it was added with (so a changed or
 * corrupted file is never imported as the release it claims to be).
 */
async function keptFile(
  label: string,
  name: string,
  sha256: string,
  options: { file?: string; dir?: string } = {},
): Promise<string> {
  if (options.file) return options.file;
  // An extracted release folder
  if (options.dir) return options.dir;
  const path = join(DATA_DIR, name);
  try {
    await checkSha256(path, sha256);
  } catch (err) {
    throw new Error(`${label}: ${(err as Error).message}`);
  }
  return path;
}

function tableJob(
  name: 'cnf' | 'fineli',
  label: string,
  path: string,
  read: (a: Archive) => Promise<FoodRecord[]>,
  log: Log,
): Job {
  return {
    name,
    source: name,
    prefix: '',
    complete: true,
    async *records() {
      const records = await withArchive(path, read);
      log(`${label}: ${records.length} foods (${basename(path)})`);
      yield* records;
    },
  };
}

/** CNF 2015: --file (the zip or its extracted folder), else data/'s copy. */
export function cnfFile(options: { file?: string; dir?: string } = {}) {
  return keptFile('CNF', CNF_FILE, CNF_SHA256, options);
}

export function cnfJob(path: string, log: Log = () => {}): Job {
  return tableJob('cnf', 'CNF', path, cnfRecords, log);
}

/** Fineli release 20: --file (the zip or its extracted folder), else data/'s copy. */
export function fineliFile(options: { file?: string; dir?: string } = {}) {
  return keptFile('Fineli', FINELI_FILE, FINELI_SHA256, options);
}

export function fineliJob(path: string, log: Log = () => {}): Job {
  return tableJob('fineli', 'Fineli', path, fineliRecords, log);
}

// ── France's CIQUAL ──────────────────────────────────────────────────────────

/**
 * CIQUAL 2025: --file a zip or folder of its XML files, else downloaded
 * from Recherche Data Gouv (and checked). Returns an archive's path or the
 * downloaded files.
 */
export async function ciqualFiles(
  options: { file?: string; dir?: string; refresh?: boolean; log?: Log } = {},
): Promise<string | string[]> {
  const local = options.file ?? options.dir;
  if (local) return local;
  const paths: string[] = [];
  for (const f of Object.values(CIQUAL_FILES)) {
    paths.push(
      await download(f.url, {
        name: f.name,
        sha256: f.sha256,
        refresh: options.refresh,
        log: options.log,
      }),
    );
  }
  return paths;
}

export function ciqualJob(
  files: string | readonly string[],
  log: Log = () => {},
): Job {
  return {
    name: 'ciqual',
    source: 'ciqual',
    prefix: '',
    complete: true,
    async *records() {
      const archive =
        typeof files === 'string'
          ? await openArchive(files)
          : openFiles('CIQUAL', files);
      let records: FoodRecord[];
      try {
        records = await ciqualRecords(archive);
      } finally {
        archive.close();
      }
      log(`CIQUAL: ${records.length} foods`);
      yield* records;
    },
  };
}
