import { createReadStream } from 'fs';
import { join } from 'path';
import * as ExcelJS from 'exceljs';
import { csvRows } from './csv';
import { COFID_FILE } from './sources/cofid';

/** The repository's fixtures folder. */
export const FIXTURES = join(__dirname, '..', 'fixtures');

const COFID_SHEETS: [string, string][] = [
  ['1.3 Proximates', 'cofid2021_proximates_sample.csv'],
  ['1.4 Inorganics', 'cofid2021_inorganics_sample.csv'],
  ['1.5 Vitamins', 'cofid2021_vitamins_sample.csv'],
];

/**
 * A CoFID workbook laid out like the real one (same sheet names, three
 * header rows, the same foods in the same order on every sheet), from the
 * CSV fixtures: real rows of the 2021 release, kept as CSV so they can be
 * read and reviewed. Returns its path in `dir`.
 */
export async function writeCofidWorkbook(dir: string): Promise<string> {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet('List of tables').addRow(['Table', 'Title']);
  for (const [name, file] of COFID_SHEETS) {
    const ws = wb.addWorksheet(name);
    for await (const row of csvRows(
      createReadStream(join(FIXTURES, 'cofid', file)),
      { skip_empty_lines: false },
    )) {
      ws.addRow(row.map((c) => (c === '' ? null : c)));
    }
  }
  const path = join(dir, COFID_FILE);
  await wb.xlsx.writeFile(path);
  return path;
}
