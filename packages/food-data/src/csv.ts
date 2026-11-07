import { parse, type Options } from 'csv-parse';
import type { Readable } from 'stream';

/**
 * Rows of a CSV file as objects keyed by its header, streamed. USDA's files
 * quote every field; Open Food Facts' export is tab-separated and
 * unquoted, so pass `{ delimiter: '\t', quote: false }` for it.
 */
export async function* csvObjects(
  input: Readable,
  options: Options = {},
): AsyncGenerator<Record<string, string>> {
  let header: string[] | null = null;
  for await (const row of csvRows(input, options)) {
    if (!header) {
      header = row;
      continue;
    }
    const obj: Record<string, string> = {};
    for (let i = 0; i < header.length; i++) obj[header[i]] = row[i] ?? '';
    yield obj;
  }
}

/** Rows of a CSV file as arrays, header included, streamed. */
export async function* csvRows(
  input: Readable,
  options: Options = {},
): AsyncGenerator<string[]> {
  const parser = input.pipe(
    parse({
      bom: true,
      relax_column_count: true,
      skip_empty_lines: true,
      ...options,
    }),
  );
  // A read error on the input doesn't reach the parser by itself
  input.once('error', (err) => parser.destroy(err));
  for await (const row of parser) yield row as string[];
}

/**
 * A CSV file's rows with the columns it's read by, looked up once from the
 * header: `col.fdc_id` is that column's index. For files too large to
 * build an object per row (USDA's 26M branded nutrient rows).
 */
export async function* csvTable<C extends string>(
  input: Readable,
  columns: readonly C[],
  options: Options = {},
): AsyncGenerator<{ row: string[]; col: Record<C, number> }> {
  let col: Record<C, number> | null = null;
  for await (const row of csvRows(input, options)) {
    if (!col) {
      const index = {} as Record<C, number>;
      for (const c of columns) {
        index[c] = row.indexOf(c);
        if (index[c] < 0) throw new Error(`CSV has no column "${c}"`);
      }
      col = index;
      continue;
    }
    yield { row, col };
  }
}
