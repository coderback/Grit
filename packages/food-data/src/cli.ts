import { resolve } from 'path';
import { parseArgs } from 'util';
import { poolFromEnv } from './db';
import { download, fetchText } from './download';
import {
  ciqualFiles,
  ciqualJob,
  cnfFile,
  cnfJob,
  cofidFile,
  cofidJob,
  deltaFilesIn,
  downloadFdc,
  fdcFilesIn,
  fdcJobs,
  fineliFile,
  fineliJob,
  isOffCsv,
  offFileInput,
  offJob,
  parseFdcDatasets,
  streamUrl,
} from './jobs';
import { runJob, statsLine, type Job } from './run';
import { fdcDatasetOf, type FdcDataset } from './sources/fdc';
import {
  deltasSince,
  lastOffChange,
  OFF_CSV_URL,
  OFF_DELTA_URL,
  OFF_JSONL_URL,
  parseDeltaIndex,
} from './sources/off';
import { emptyStats, type WriteStats } from './writer';

const USAGE = `Imports a source into GRIT's food database (DIRECT_URL, else DATABASE_URL).

  npm run import -w packages/food-data -- <source> [options]

Sources:
  fdc         USDA FoodData Central: Foundation + SR Legacy, FNDDS, Branded
  off         Open Food Facts, a full export (the JSONL by default; or --file a CSV)
  off-delta   Open Food Facts' daily changes since the last import
  cofid       UK CoFID 2021 (McCance and Widdowson's)
  cnf         Canada's Canadian Nutrient File 2015 (kept in data/)
  ciqual      France's ANSES-CIQUAL 2025 (from Recherche Data Gouv)
  fineli      Finland's Fineli, release 20 (kept in data/)

Options:
  --file <path>       a local file instead of downloading (repeatable for fdc)
  --dir <path>        a folder of local files (USDA's names; delta files; an
                      extracted CNF, Fineli or CIQUAL release)
  --dataset <list>    fdc: foundation,sr,fndds,branded (default foundation,sr,fndds)
  --limit <n>         stop after n records (a sample)
  --dry-run           write nothing; report what would change
  --full              after a complete import, remove this dataset's rows the
                      source no longer has (never another dataset's)
  --max-remove <n>    with --full: refuse to remove more rows than this
                      (default 10% of the dataset's rows, at least 100)
  --batch <n>         records per transaction (default 2000)
  --refresh           download again even when cached
  off, off-delta:
  --min-scans <n>     only products scanned by at least n people
  --countries <list>  only products sold in these, e.g. gb,us
  --only-existing     only update products already in the database
  --format jsonl|csv  how to read --file (default: from its name)
  off-delta:
  --since <unix>      changes after this time, instead of the last imported
  --overlap-days <n>  re-read this many days before the last import (default 2)

Downloads are cached in FOOD_DATA_CACHE (default packages/food-data/.cache).
Behind an HTTP proxy, set NODE_USE_ENV_PROXY=1.`;

const log = (line: string) => console.log(line);

function int(value: string | undefined, name: string): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`--${name} must be a whole number`);
  }
  return n;
}

async function main(argv: string[]) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      file: { type: 'string', multiple: true },
      dir: { type: 'string' },
      dataset: { type: 'string' },
      limit: { type: 'string' },
      'dry-run': { type: 'boolean' },
      full: { type: 'boolean' },
      'max-remove': { type: 'string' },
      batch: { type: 'string' },
      refresh: { type: 'boolean' },
      'min-scans': { type: 'string' },
      countries: { type: 'string' },
      'only-existing': { type: 'boolean' },
      format: { type: 'string' },
      since: { type: 'string' },
      'overlap-days': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  const source = positionals[0];
  if (values.help || !source) {
    console.log(USAGE);
    return values.help ? 0 : 1;
  }
  if (positionals.length > 1) {
    throw new Error(`One source at a time (got ${positionals.join(', ')})`);
  }

  // Paths as typed where npm was run (`npm run -w` runs in this package)
  const here = process.env.INIT_CWD || process.cwd();
  const files = (values.file ?? []).map((f) => resolve(here, f));
  if (values.dir) values.dir = resolve(here, values.dir);
  const limit = int(values.limit, 'limit');
  if (values.batch !== undefined && !int(values.batch, 'batch')) {
    throw new Error('--batch must be at least 1');
  }
  const dryRun = !!values['dry-run'];
  const run = {
    batchSize: int(values.batch, 'batch'),
    dryRun,
    limit,
    full: !!values.full,
    maxRemove: int(values['max-remove'], 'max-remove'),
    log,
  };
  const countries = values.countries
    ?.split(',')
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
  if (countries?.some((c) => !/^[a-z]{2}$/.test(c))) {
    throw new Error('--countries takes two-letter codes, e.g. gb,us');
  }
  const offFilter = {
    minScans: int(values['min-scans'], 'min-scans'),
    countries,
  };
  if (source !== 'off' && source !== 'off-delta') {
    for (const o of ['min-scans', 'countries', 'only-existing', 'format']) {
      if (values[o as keyof typeof values] !== undefined) {
        throw new Error(`--${o} is for off and off-delta`);
      }
    }
  }

  const pool = poolFromEnv();
  const client = await pool.connect();
  const started = Date.now();
  const total: WriteStats = emptyStats();
  try {
    let jobs: Job[] = [];

    if (source === 'fdc') {
      const datasets = parseFdcDatasets(values.dataset);
      let paths: Partial<Record<FdcDataset, string>>;
      if (files.length) {
        paths = {};
        for (const f of files) {
          const d = fdcDatasetOf(f);
          if (!d) {
            throw new Error(
              `Can't tell which dataset ${f} is: keep USDA's file name`,
            );
          }
          paths[d] = f;
        }
      } else if (values.dir) {
        paths = await fdcFilesIn(values.dir);
      } else {
        paths = await downloadFdc(datasets, {
          refresh: values.refresh,
          log,
        });
      }
      const chosen: Partial<Record<FdcDataset, string>> = {};
      for (const d of datasets) {
        if (!paths[d]) throw new Error(`No ${d} file found`);
        chosen[d] = paths[d];
      }
      jobs = fdcJobs(chosen, log);
    } else if (source === 'off') {
      if (values['only-existing'] && values.full) {
        throw new Error("--full and --only-existing don't go together");
      }
      const file = files[0] ?? values.dir;
      if (files.length > 1) throw new Error('off takes one --file');
      const csv =
        values.format === 'csv' ||
        (values.format !== 'jsonl' && !!file && isOffCsv(file));
      const url = csv ? OFF_CSV_URL : OFF_JSONL_URL;
      const input = file
        ? offFileInput(file)
        : async () => {
            log(`Streaming ${url} (not cached: about 13 GB)`);
            return { input: await streamUrl(url), csv, label: url };
          };
      jobs = [
        offJob('off', [async () => ({ ...(await input()), csv })], {
          ...offFilter,
          existingIn: values['only-existing'] ? pool : undefined,
          complete: true,
          log,
        }),
      ];
    } else if (source === 'off-delta') {
      if (values.full)
        throw new Error('--full is for full imports, not deltas');
      let paths: string[];
      if (files.length || values.dir) {
        paths = [];
        for (const f of [...files, ...(values.dir ? [values.dir] : [])]) {
          paths.push(...(await deltaFilesIn(f)));
        }
      } else {
        const index = parseDeltaIndex(
          await fetchText(`${OFF_DELTA_URL}index.txt`),
        );
        let since = int(values.since, 'since');
        if (since === undefined) {
          const last = await lastOffChange(pool);
          if (last === null) {
            if (values['only-existing']) {
              log(
                'No Open Food Facts products in the database: nothing to update.',
              );
              return 0;
            }
            since = 0;
          } else {
            // Products saved by the live barcode lookup can be newer than
            // the last delta imported, so re-read a little before it
            const overlap = int(values['overlap-days'], 'overlap-days') ?? 2;
            since = last - overlap * 86_400;
          }
        }
        if (index.length && since > 0 && since < index[0].from) {
          log(
            `Warning: OFF keeps deltas from ${new Date(index[0].from * 1000).toISOString()} only, after ${new Date(since * 1000).toISOString()}: changes in between are missing until a full import`,
          );
        }
        const wanted = deltasSince(index, since);
        log(
          `${wanted.length} of ${index.length} delta files are after ${since ? new Date(since * 1000).toISOString() : 'the start'}`,
        );
        paths = [];
        for (const d of wanted) {
          paths.push(
            await download(OFF_DELTA_URL + d.name, {
              refresh: values.refresh,
              log,
            }),
          );
        }
      }
      jobs = paths.length
        ? [
            offJob('off-delta', paths.map(offFileInput), {
              ...offFilter,
              existingIn: values['only-existing'] ? pool : undefined,
              complete: false,
              log,
            }),
          ]
        : [];
    } else if (source === 'cofid') {
      if (files.length > 1) throw new Error('cofid takes one --file');
      const path = await cofidFile({
        file: files[0],
        dir: values.dir,
        refresh: values.refresh,
        log,
      });
      jobs = [cofidJob(path, log)];
    } else if (source === 'cnf' || source === 'fineli') {
      if (files.length > 1) throw new Error(`${source} takes one --file`);
      const options = { file: files[0], dir: values.dir };
      jobs = [
        source === 'cnf'
          ? cnfJob(await cnfFile(options), log)
          : fineliJob(await fineliFile(options), log),
      ];
    } else if (source === 'ciqual') {
      if (files.length > 1) {
        throw new Error('ciqual takes one --file (a zip) or --dir');
      }
      jobs = [
        ciqualJob(
          await ciqualFiles({
            file: files[0],
            dir: values.dir,
            refresh: values.refresh,
            log,
          }),
          log,
        ),
      ];
    } else {
      throw new Error(
        `Unknown source "${source}": use fdc, off, off-delta, cofid, cnf, ciqual or fineli`,
      );
    }

    if (dryRun) log('Dry run: nothing will be saved.');
    for (const job of jobs) {
      const stats = await runJob(client, job, run);
      for (const k of Object.keys(total) as (keyof WriteStats)[]) {
        total[k] += stats[k];
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
  log(
    `Done in ${((Date.now() - started) / 1000).toFixed(1)} s${dryRun ? ' (dry run)' : ''}: ${statsLine(total)}`,
  );
  log(JSON.stringify(total));
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (err: unknown) => {
    console.error(err instanceof Error ? (err.stack ?? err.message) : err);
    process.exitCode = 1;
  },
);
