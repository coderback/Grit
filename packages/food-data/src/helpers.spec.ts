import { createHash } from 'crypto';
import { existsSync } from 'fs';
import { mkdtemp, readdir, readFile, rm } from 'fs/promises';
import { createServer, type Server } from 'http';
import type { AddressInfo } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import type { PoolClient } from 'pg';
import { openArchive, readText } from './archive';
import { cacheDir, download } from './download';
import { runJob, take, type Job } from './run';
import { FIXTURES } from './test-fixtures';

describe('archives', () => {
  it('reads a release zip by base name, whatever folder it has inside', async () => {
    const zip = await openArchive(
      join(FIXTURES, 'fdc/FoodData_Central_sr_legacy_food_csv_2018-04.zip'),
    );
    try {
      expect(zip.names.sort()).toEqual([
        'food.csv',
        'food_category.csv',
        'food_nutrient.csv',
        'food_portion.csv',
        'sr_legacy_food.csv',
      ]);
      expect(zip.has('FOOD.csv')).toBe(true);
      expect(zip.find(/sr_legacy/)).toBe('sr_legacy_food.csv');
      const text = await readText(zip, 'sr_legacy_food.csv');
      expect(text.split('\n')[0]).toBe('"fdc_id","NDB_number"');
      await expect(zip.open('missing.csv')).rejects.toThrow(/no missing\.csv/);
    } finally {
      zip.close();
    }
  });

  it('reads a folder and a single file the same way', async () => {
    const dir = await openArchive(
      join(FIXTURES, 'fdc/FoodData_Central_branded_food_csv_2026-10-29'),
    );
    expect(dir.names.sort()).toEqual([
      'branded_food.csv',
      'food.csv',
      'food_nutrient.csv',
    ]);
    const file = await openArchive(
      join(FIXTURES, 'fdc/FoodData_Central_survey_food_json_2024-10-31.json'),
    );
    expect(file.find(/\.json$/)).toBe(
      'fooddata_central_survey_food_json_2024-10-31.json',
    );
    expect((await readText(file, file.names[0])).startsWith('{')).toBe(true);
  });
});

describe('downloads', () => {
  let server: Server;
  let base: string;
  let hits = 0;
  let cache: string;
  const body = 'fdc_id,NDB_number\n1,2\n';

  beforeAll(async () => {
    cache = await mkdtemp(join(tmpdir(), 'cache-'));
    process.env.FOOD_DATA_CACHE = cache;
    server = createServer((req, res) => {
      hits++;
      if (req.url === '/missing.zip') {
        res.statusCode = 404;
        res.end();
        return;
      }
      res.setHeader('content-length', Buffer.byteLength(body));
      res.end(body);
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    delete process.env.FOOD_DATA_CACHE;
    await new Promise((r) => server.close(r));
    await rm(cache, { recursive: true });
  });

  it('streams into the cache once, then reuses the file', async () => {
    expect(cacheDir()).toBe(cache);
    const path = await download(`${base}/data/release_2026-10-29.zip`);
    expect(path).toBe(join(cache, 'release_2026-10-29.zip'));
    expect(await readFile(path, 'utf8')).toBe(body);
    expect(await download(`${base}/data/release_2026-10-29.zip`)).toBe(path);
    expect(hits).toBe(1);
    // Unless asked to download again
    await download(`${base}/data/release_2026-10-29.zip`, { refresh: true });
    expect(hits).toBe(2);
  });

  it('checks a checksum, keeping nothing when it fails', async () => {
    const sha256 = createHash('sha256').update(body).digest('hex');
    await download(`${base}/ok.xlsx`, { sha256 });
    await expect(
      download(`${base}/bad.xlsx`, { sha256: '0'.repeat(64) }),
    ).rejects.toThrow(/SHA-256/);
    expect(existsSync(join(cache, 'bad.xlsx'))).toBe(false);
    expect((await readdir(cache)).some((f) => f.endsWith('.part'))).toBe(false);
  });

  it('fails on an HTTP error', async () => {
    await expect(download(`${base}/missing.zip`)).rejects.toThrow(/HTTP 404/);
    expect(existsSync(join(cache, 'missing.zip'))).toBe(false);
  });
});

describe('runs', () => {
  it('takes a sample and closes the source', async () => {
    let closed = false;
    async function* source() {
      try {
        for (let i = 0; ; i++) yield await Promise.resolve(i);
      } finally {
        closed = true;
      }
    }
    const out: number[] = [];
    for await (const n of take(source(), 3)) out.push(n);
    expect(out).toEqual([0, 1, 2]);
    expect(closed).toBe(true);
  });

  it('refuses a full import of a sample or a filtered read', async () => {
    const job: Job = {
      name: 'test',
      source: 'off',
      prefix: '',
      complete: false,
      records: () => source(),
    };
    async function* source() {}
    const client = {} as PoolClient;
    await expect(runJob(client, job, { full: true })).rejects.toThrow(
      /--full needs a complete import/,
    );
    await expect(
      runJob(client, { ...job, complete: true }, { full: true, limit: 10 }),
    ).rejects.toThrow(/--full/);
  });
});
