import { createWriteStream, existsSync } from 'fs';
import { mkdir, rename, rm, stat } from 'fs/promises';
import { basename, join, resolve } from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import type { ReadableStream as WebReadableStream } from 'stream/web';

/**
 * Where downloads are kept: FOOD_DATA_CACHE, else packages/food-data/.cache.
 * Files are named as the source names them, and source files with a date
 * or time range in the name never change, so a cached file is reused.
 */
export function cacheDir(env: NodeJS.ProcessEnv = process.env) {
  return resolve(env.FOOD_DATA_CACHE || join(__dirname, '..', '.cache'));
}

const USER_AGENT = 'GRIT food-data importer/1.0 (support@gritapp.io)';

async function get(url: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
  } catch (err) {
    const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
    const hint =
      proxy && !process.env.NODE_USE_ENV_PROXY
        ? ' (behind a proxy? set NODE_USE_ENV_PROXY=1 so Node uses HTTPS_PROXY)'
        : '';
    throw new Error(
      `Couldn't fetch ${url}: ${(err as Error).cause ? String((err as Error & { cause: unknown }).cause) : (err as Error).message}${hint}`,
    );
  }
  if (!res.ok) {
    throw new Error(`Couldn't fetch ${url}: HTTP ${res.status}`);
  }
  return res;
}

/** A small text file, never cached (an index of what to download). */
export async function fetchText(url: string): Promise<string> {
  return (await get(url)).text();
}

export interface DownloadOptions {
  /** File name in the cache; defaults to the URL's last segment */
  name?: string;
  /** Download again even when cached */
  refresh?: boolean;
  log?: (line: string) => void;
}

/**
 * Streams a file into the cache (never into memory) and returns its path.
 * A cached copy is reused. A partial download is written to `.part` and
 * only renamed once complete, so an interrupted run never leaves a
 * truncated file behind that a later run would trust.
 */
export async function download(
  url: string,
  options: DownloadOptions = {},
): Promise<string> {
  const dir = cacheDir();
  await mkdir(dir, { recursive: true });
  const name = options.name ?? basename(new URL(url).pathname);
  const path = join(dir, name);
  if (!options.refresh && existsSync(path) && (await stat(path)).size > 0) {
    options.log?.(`Using cached ${path}`);
    return path;
  }

  const res = await get(url);
  const total = Number(res.headers.get('content-length')) || 0;
  options.log?.(
    `Downloading ${url}${total ? ` (${(total / 1e6).toFixed(1)} MB)` : ''}`,
  );
  const part = `${path}.part`;
  let done = 0;
  let lastLog = Date.now();
  const body = Readable.fromWeb(res.body as WebReadableStream<Uint8Array>);
  body.on('data', (chunk: Buffer) => {
    done += chunk.length;
    if (Date.now() - lastLog > 10_000) {
      lastLog = Date.now();
      options.log?.(
        `  ${(done / 1e6).toFixed(0)} MB${total ? ` of ${(total / 1e6).toFixed(0)} MB` : ''}`,
      );
    }
  });
  try {
    await pipeline(body, createWriteStream(part));
    if (total && done !== total) {
      throw new Error(`got ${done} of ${total} bytes`);
    }
  } catch (err) {
    await rm(part, { force: true });
    throw new Error(`Download of ${url} failed: ${(err as Error).message}`);
  }
  await rename(part, path);
  return path;
}
