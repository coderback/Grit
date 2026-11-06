import * as ExcelJS from 'exceljs';
import type {
  NutrientCode,
  NutrientValues,
} from '../../../backend/src/food/nutrients';
import type { FoodRecord } from '../record';
import { COFID_GROUPS } from './cofid-groups';

/**
 * UK CoFID: McCance and Widdowson's Composition of Foods Integrated
 * Dataset 2021 (Public Health England; Open Government Licence v3.0).
 * The 2021 release is the latest; the "old foods" file isn't imported.
 *
 * One workbook, one sheet per nutrient group, the same foods in the same
 * row order on every sheet: row 1 a display header, row 2 the nutrient
 * acronyms (what columns are found by), row 3 long names, then foods.
 * Values are per 100 g (alcoholic drinks per 100 ml, taken as per 100 g).
 */

export const COFID_URL =
  'https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx';
export const COFID_FILE =
  'McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx';
export const COFID_SHA256 =
  '436e9445ef2adb2a75f3d7edd51302de3adad25385f9795fc94ba58bd030e97d';
/** When gov.uk last updated the dataset: every record's fetchedAt */
export const COFID_RELEASE = new Date('2021-03-19T00:00:00Z');

export type Cell = string | number | null;
/** A sheet's rows as cells, header rows included (0-based columns). */
export type SheetRows = Cell[][];

export interface CofidSheets {
  proximates: SheetRows;
  inorganics: SheetRows;
  vitamins: SheetRows;
}

/** Sheets are found by their table number, not their position or title. */
const SHEETS: Record<keyof CofidSheets, string> = {
  proximates: '1.3',
  inorganics: '1.4',
  vitamins: '1.5',
};

function cellValue(v: ExcelJS.CellValue): Cell {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string' || typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') {
    if ('richText' in v) return v.richText.map((t) => t.text).join('');
    if ('result' in v) return cellValue(v.result);
    if ('text' in v) return String(v.text);
  }
  return null;
}

/** The three sheets GRIT reads from the CoFID workbook. */
export async function readCofidWorkbook(path: string): Promise<CofidSheets> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const out: Partial<CofidSheets> = {};
  for (const [key, prefix] of Object.entries(SHEETS) as [
    keyof CofidSheets,
    string,
  ][]) {
    const ws = wb.worksheets.find((w) =>
      w.name.trim().startsWith(`${prefix} `),
    );
    if (!ws) throw new Error(`${path} has no sheet ${prefix}`);
    const rows: SheetRows = [];
    ws.eachRow({ includeEmpty: true }, (row, n) => {
      // row.values is 1-based
      const values = (row.values as ExcelJS.CellValue[]).slice(1);
      rows[n - 1] = values.map(cellValue);
    });
    out[key] = Array.from(rows, (r) => r ?? []);
  }
  return out as CofidSheets;
}

/**
 * A CoFID value: a number (as a number or text, with a decimal point or
 * comma), "Tr" (a trace, below the reporting limit) as 0. "N" (present,
 * amount unknown), blanks, bracketed estimates and anything else are
 * missing, never zero.
 */
export function cofidNumber(cell: Cell | undefined): number | undefined {
  if (cell === null || cell === undefined) return undefined;
  if (typeof cell === 'number') return Number.isFinite(cell) ? cell : undefined;
  const s = cell.trim();
  if (/^tr$/i.test(s)) return 0;
  if (!/^-?\d+(?:[.,]\d+)?$/.test(s)) return undefined;
  return Number(s.replace(',', '.'));
}

/** The 0-based column of each acronym in a sheet's second header row. */
function columns(rows: SheetRows, sheet: string, wanted: readonly string[]) {
  const header = (rows[1] ?? []).map((c) =>
    typeof c === 'string' ? c.trim() : c,
  );
  const out: Record<string, number> = {};
  for (const acronym of wanted) {
    const i = header.indexOf(acronym);
    if (i < 0) throw new Error(`CoFID sheet ${sheet} has no ${acronym} column`);
    out[acronym] = i;
  }
  return out;
}

// [GRIT code, sheet, acronyms in priority order]
const SIMPLE: readonly [NutrientCode, keyof CofidSheets, readonly string[]][] =
  [
    ['kcal', 'proximates', ['KCALS']],
    ['protein_g', 'proximates', ['PROT']],
    // Available carbohydrate (excludes fibre), as CoFID gives it
    ['carbs_g', 'proximates', ['CHO']],
    ['sugars_g', 'proximates', ['TOTSUG']],
    ['fat_g', 'proximates', ['FAT']],
    // Per 100 g food, not per 100 g fatty acids (SATFAC)
    ['sat_fat_g', 'proximates', ['SATFOD']],
    // AOAC (what labels and the US use), else Englyst NSP
    ['fibre_g', 'proximates', ['AOACFIB', 'ENGFIB']],
    ['alcohol_g', 'proximates', ['ALCO']],
    ['sodium_mg', 'inorganics', ['NA']],
    ['potassium_mg', 'inorganics', ['K']],
    ['calcium_mg', 'inorganics', ['CA']],
    ['magnesium_mg', 'inorganics', ['MG']],
    ['phosphorus_mg', 'inorganics', ['P']],
    ['iron_mg', 'inorganics', ['FE']],
    ['zinc_mg', 'inorganics', ['ZN']],
    ['selenium_ug', 'inorganics', ['SE']],
    ['vit_c_mg', 'vitamins', ['VITC']],
    ['vit_d_ug', 'vitamins', ['VITD']],
    // α-tocopherol equivalents
    ['vit_e_mg', 'vitamins', ['VITE']],
    ['vit_k_ug', 'vitamins', ['VITK1']],
    ['b1_mg', 'vitamins', ['THIA']],
    ['b2_mg', 'vitamins', ['RIBO']],
    // Preformed niacin, as USDA and labels give it (not NIACEQU)
    ['b3_mg', 'vitamins', ['NIAC']],
    ['b6_mg', 'vitamins', ['VITB6']],
    ['b12_ug', 'vitamins', ['VITB12']],
    // Total folate: CoFID has no DFE
    ['folate_ug', 'vitamins', ['FOLT']],
  ];

/** Two foods share code 13-669: such codes get the name, slugged. */
function slug(name: string) {
  return name
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

const text = (c: Cell | undefined) =>
  c === null || c === undefined ? '' : String(c).trim();

/** CoFID's foods as records, joined across sheets by row. */
export function cofidRecords(sheets: CofidSheets): FoodRecord[] {
  const cols = {
    proximates: columns(
      sheets.proximates,
      '1.3',
      SIMPLE.filter(([, s]) => s === 'proximates').flatMap(([, , a]) => a),
    ),
    inorganics: columns(
      sheets.inorganics,
      '1.4',
      SIMPLE.filter(([, s]) => s === 'inorganics').flatMap(([, , a]) => a),
    ),
    vitamins: columns(sheets.vitamins, '1.5', [
      ...SIMPLE.filter(([, s]) => s === 'vitamins').flatMap(([, , a]) => a),
      'RET',
      'CAREQU',
    ]),
  };

  // Data starts on row 4; columns A, B and D are code, name and group
  const foods = sheets.proximates.slice(3).filter((r) => text(r[0]));
  const counts = new Map<string, number>();
  for (const r of foods) {
    counts.set(text(r[0]), (counts.get(text(r[0])) ?? 0) + 1);
  }

  return foods.map((row, i) => {
    const code = text(row[0]);
    const name = text(row[1]);
    const rowOf = (sheet: keyof CofidSheets) => {
      const r = sheets[sheet][i + 3] ?? [];
      if (text(r[0]) !== code || text(r[1]) !== name) {
        throw new Error(
          `CoFID sheets aren't in the same food order (row ${i + 4}: ${code} ${name})`,
        );
      }
      return r;
    };
    const rows = {
      proximates: row,
      inorganics: rowOf('inorganics'),
      vitamins: rowOf('vitamins'),
    };

    const nutrients: NutrientValues = {};
    for (const [codeName, sheet, acronyms] of SIMPLE) {
      for (const a of acronyms) {
        const v = cofidNumber(rows[sheet][cols[sheet][a]]);
        if (v !== undefined) {
          nutrients[codeName] = v;
          break;
        }
      }
    }
    // Vitamin A as RAE: retinol + β-carotene equivalents / 12 (CoFID's own
    // retinol equivalents divide by 6)
    const ret = cofidNumber(rows.vitamins[cols.vitamins.RET]);
    const car = cofidNumber(rows.vitamins[cols.vitamins.CAREQU]);
    if (ret !== undefined && car !== undefined) {
      nutrients.vit_a_ug = ret + car / 12;
    }

    const group = text(row[3]);
    return {
      source: 'cofid',
      externalId: (counts.get(code) ?? 0) > 1 ? `${code}~${slug(name)}` : code,
      fetchedAt: COFID_RELEASE,
      name,
      kind: 'generic',
      category: COFID_GROUPS[group] ?? null,
      countries: ['gb'],
      nutrients,
      basis: 'measured',
      quality: 1,
      verified: true,
    } satisfies FoodRecord;
  });
}
