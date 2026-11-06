import { createReadStream } from 'fs';
import { readdir, stat } from 'fs/promises';
import { basename, join } from 'path';
import type { Readable } from 'stream';
import * as yauzl from 'yauzl';

/**
 * The files of one dataset, whether it's a zip (read with yauzl, streamed
 * entry by entry, never extracted to disk), an extracted folder, or a
 * single file. Entries are found by their base name, so the folder inside
 * a release zip ("FoodData_Central_sr_legacy_food_csv_2018-04/food.csv")
 * doesn't matter.
 */
export interface Archive {
  /** The archive's path, for messages */
  path: string;
  /** Base names of every file in it */
  names: string[];
  /** Whether it has a file with this base name (case-insensitive) */
  has(name: string): boolean;
  /** The file with this base name as a stream; rejects when it's missing */
  open(name: string): Promise<Readable>;
  /** The first file whose base name matches */
  find(pattern: RegExp): string | undefined;
  close(): void;
}

const key = (name: string) => basename(name).toLowerCase();

export async function openArchive(path: string): Promise<Archive> {
  const info = await stat(path);
  if (info.isDirectory()) return openDirectory(path);
  if (/\.zip$/i.test(path)) return openZip(path);
  return fromFiles(path, new Map([[key(path), path]]), () => {});
}

async function openDirectory(dir: string): Promise<Archive> {
  const files = new Map<string, string>();
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  // Shallowest first, so a file at the top wins over one in a subfolder
  entries.sort(
    (a, b) =>
      a.parentPath.length - b.parentPath.length || a.name.localeCompare(b.name),
  );
  for (const e of entries) {
    if (!e.isFile()) continue;
    const k = key(e.name);
    if (!files.has(k)) files.set(k, join(e.parentPath, e.name));
  }
  return fromFiles(dir, files, () => {});
}

function fromFiles(
  path: string,
  files: Map<string, string>,
  close: () => void,
): Archive {
  return {
    path,
    names: [...files.keys()],
    has: (name) => files.has(key(name)),
    find: (pattern) => [...files.keys()].find((n) => pattern.test(n)),
    open: (name) => {
      const file = files.get(key(name));
      return file
        ? Promise.resolve(createReadStream(file))
        : Promise.reject(new Error(`${path} has no ${name}`));
    },
    close,
  };
}

async function openZip(path: string): Promise<Archive> {
  const zip = await new Promise<yauzl.ZipFile>((resolve, reject) =>
    yauzl.open(path, { lazyEntries: true, autoClose: false }, (err, z) =>
      err ? reject(err) : resolve(z),
    ),
  );
  const entries = new Map<string, yauzl.Entry>();
  await new Promise<void>((resolve, reject) => {
    zip.on('entry', (entry: yauzl.Entry) => {
      if (!entry.fileName.endsWith('/')) {
        const k = key(entry.fileName);
        if (!entries.has(k)) entries.set(k, entry);
      }
      zip.readEntry();
    });
    zip.once('end', () => resolve());
    zip.once('error', reject);
    zip.readEntry();
  });
  return {
    path,
    names: [...entries.keys()],
    has: (name) => entries.has(key(name)),
    find: (pattern) => [...entries.keys()].find((n) => pattern.test(n)),
    open: (name) =>
      new Promise<Readable>((resolve, reject) => {
        const entry = entries.get(key(name));
        if (!entry) return reject(new Error(`${path} has no ${name}`));
        zip.openReadStream(entry, (err, stream) =>
          err ? reject(err) : resolve(stream),
        );
      }),
    close: () => zip.close(),
  };
}

/** A whole (small) file of an archive as text. */
export async function readText(archive: Archive, name: string) {
  const chunks: Buffer[] = [];
  for await (const chunk of await archive.open(name)) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}
