import type { PoolClient } from 'pg';
import type { FoodRecord, SourceId } from './record';
import { emptyStats, removeMissing, writeFoods, type WriteStats } from './writer';

/** One dataset to import: what the CLI runs and the tests drive. */
export interface Job {
  /** For messages: "fdc foundation+sr" */
  name: string;
  source: SourceId;
  /**
   * The externalIds this job owns, e.g. "fndds:" of fdc. A full import
   * only removes missing rows under it, never another dataset's.
   */
  prefix: string;
  /** False when the job reads part of a dataset, so --full can't apply */
  complete: boolean;
  records(): AsyncIterable<FoodRecord>;
  /** Runs after the records are written, e.g. removing withdrawn products; returns rows removed */
  finish?(client: PoolClient, options: { dryRun: boolean }): Promise<number>;
}

export interface RunOptions {
  batchSize?: number;
  dryRun?: boolean;
  /** Stop after this many records (a sample: never with `full`) */
  limit?: number;
  /** After a complete import, remove this job's rows the source no longer has */
  full?: boolean;
  /**
   * The most rows a full import may remove before it refuses (a
   * truncated download shouldn't empty a dataset). Default: 10% of the
   * job's rows, at least 100.
   */
  maxRemove?: number;
  log?: (line: string) => void;
}

/** The first `limit` items (all when undefined), closing the source after. */
export async function* take<T>(items: AsyncIterable<T>, limit?: number) {
  if (limit === undefined) {
    yield* items;
    return;
  }
  if (limit <= 0) return;
  let n = 0;
  for await (const item of items) {
    yield item;
    if (++n >= limit) return;
  }
}

const fmt = (n: number) => n.toLocaleString('en-US');

export function statsLine(s: WriteStats) {
  return [
    `read ${fmt(s.read)}`,
    `skipped ${fmt(s.skipped)}`,
    `inserted ${fmt(s.foodsInserted)}`,
    `updated ${fmt(s.foodsUpdated)}`,
    `nutrients ${fmt(s.nutrientsChanged)}`,
    `servings ${fmt(s.servingsChanged)}`,
    `barcodes +${fmt(s.barcodesAdded)}`,
    `names +${fmt(s.namesAdded)}`,
    `sources ${fmt(s.sourcesChanged)}`,
    `removed ${fmt(s.removed)}`,
  ].join(' · ');
}

/**
 * Writes one job's records, then (with `full`) removes the job's rows the
 * source no longer lists, and runs the job's own clean-up.
 */
export async function runJob(
  client: PoolClient,
  job: Job,
  options: RunOptions = {},
): Promise<WriteStats> {
  const log = options.log ?? (() => {});
  if (options.full && (!job.complete || options.limit !== undefined)) {
    throw new Error(
      `--full needs a complete import of ${job.name}: no --limit or filters`,
    );
  }
  const started = Date.now();
  let lastLog = 0;
  const seen = options.full ? new Set<string>() : undefined;
  const stats = await writeFoods(client, take(job.records(), options.limit), {
    batchSize: options.batchSize,
    dryRun: options.dryRun,
    seen,
    onProgress: (s) => {
      if (Date.now() - lastLog < 5_000) return;
      lastLog = Date.now();
      const rate = s.read / Math.max(1, (Date.now() - started) / 1000);
      log(`[${job.name}] ${statsLine(s)} (${fmt(Math.round(rate))}/s)`);
    },
  });

  if (seen) {
    if (!seen.size) {
      throw new Error(
        `${job.name}: nothing was imported, so nothing is removed (is the file empty?)`,
      );
    }
    const { rows } = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM food_sources
       WHERE source = $1 AND starts_with("externalId", $2)`,
      [job.source, job.prefix],
    );
    const maxRemove =
      options.maxRemove ?? Math.max(100, Math.ceil(rows[0].n * 0.1));
    stats.removed += await removeMissing(client, job.source, seen, {
      prefix: job.prefix,
      dryRun: options.dryRun,
      maxRemove,
    });
  }
  if (job.finish) {
    stats.removed += await job.finish(client, { dryRun: !!options.dryRun });
  }
  log(
    `[${job.name}] done in ${((Date.now() - started) / 1000).toFixed(1)} s: ${statsLine(stats)}`,
  );
  return stats;
}
