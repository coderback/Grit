import type {
  NutrientCode,
  NutrientValues,
} from '../../../backend/src/food/nutrients';
import type { Archive } from '../archive';
import { csvObjects } from '../csv';
import type { FoodRecord } from '../record';

/**
 * Finland's Fineli: the national food composition database, release 20,
 * basic package 2 (74 components) (Finnish Institute for Health and
 * Welfare, THL; CC BY 4.0). Fineli's site refuses servers, so the zip, as
 * downloaded in a browser, is kept in this package (data/) and checked by
 * its SHA-256.
 *
 * Semicolon-separated, unquoted, Latin-1 files with CRLF line ends and
 * decimal commas: food.csv (type, use class), foodname_EN/FI/SV.csv (names
 * in capitals), component_value.csv (one row per food and component, per
 * 100 g edible part), foodaddunit.csv (each unit's weight in grams).
 */

export const FINELI_FILE = 'Fineli_Rel20_74_ravintotekijaa.zip';
export const FINELI_SHA256 =
  'e7e6bd8d4b9261d751229e763dad436b297d36d48fe853faf49e1fd2a116d262';
/** Release 20's files are dated 8 August 2019 */
export const FINELI_RELEASE = new Date('2019-08-08T00:00:00Z');

const CSV = { delimiter: ';', quote: false, encoding: 'latin1' } as const;

/** Fineli component codes (EuroFIR) for each GRIT code, first present wins. */
const COMPONENTS: readonly [NutrientCode, readonly string[]][] = [
  ['protein_g', ['PROT']],
  // Available carbohydrate (excludes fibre), as EU tables give it
  ['carbs_g', ['CHOAVL']],
  ['sugars_g', ['SUGAR']],
  ['fat_g', ['FAT']],
  ['sat_fat_g', ['FASAT']],
  ['fibre_g', ['FIBC']],
  ['alcohol_g', ['ALC']],
  ['sodium_mg', ['NA']],
  ['potassium_mg', ['K']],
  ['calcium_mg', ['CA']],
  ['magnesium_mg', ['MG']],
  ['phosphorus_mg', ['P']],
  ['iron_mg', ['FE']],
  ['zinc_mg', ['ZN']],
  ['selenium_ug', ['SE']],
  ['vit_a_ug', ['VITA']], // RAE
  ['vit_c_mg', ['VITC']],
  ['vit_d_ug', ['VITD']],
  ['vit_e_mg', ['VITE']], // α-tocopherol
  ['vit_k_ug', ['VITK']],
  ['b1_mg', ['THIA']],
  ['b2_mg', ['RIBF']],
  ['b3_mg', ['NIA']], // preformed niacin
  ['b6_mg', ['VITPYRID']],
  ['b12_ug', ['VITB12']],
  // Total folate: Fineli has no DFE
  ['folate_ug', ['FOL']],
];

export const FINELI_COMPONENTS = new Set([
  ...COMPONENTS.flatMap(([, c]) => c),
  'ENERC',
  'NACL',
]);

/** Fineli values (component → amount per 100 g) in GRIT's codes and units. */
export function fineliNutrients(
  values: ReadonlyMap<string, number>,
): NutrientValues {
  const out: NutrientValues = {};
  for (const [code, components] of COMPONENTS) {
    for (const c of components) {
      const v = values.get(c);
      if (v !== undefined) {
        out[code] = v;
        break;
      }
    }
  }
  // Energy is in kJ only
  const kj = values.get('ENERC');
  if (kj !== undefined) out.kcal = kj / 4.184;
  // Salt in mg: 1 g salt has 400 mg sodium
  const salt = values.get('NACL');
  if (out.sodium_mg === undefined && salt !== undefined) {
    out.sodium_mg = salt * 0.4;
  }
  return out;
}

/** "1698,30" → 1698.3; blanks and anything else are missing. */
export function fineliNumber(s: string | undefined): number | undefined {
  const t = (s ?? '').trim();
  if (!/^-?\d+(?:,\d+)?$/.test(t)) return undefined;
  return Number(t.replace(',', '.'));
}

/**
 * Fineli's capitals in sentence case: "RYE BREAD, 51% RYE" → "Rye bread,
 * 51% rye". Words with "&" ("D&C") keep their capitals.
 */
export function sentenceCase(name: string): string {
  const s = name
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => (w.includes('&') ? w : w.toLocaleLowerCase('fi')))
    .join(' ');
  return s.charAt(0).toLocaleUpperCase('fi') + s.slice(1);
}

/** Fineli's units GRIT shows, in the order shown; kg, l and others aren't portions. */
const UNITS: readonly [string, string][] = [
  ['KPL_VALM', '1 piece, as sold'],
  ['KPL_S', '1 small piece'],
  ['KPL_M', '1 piece'],
  ['KPL_L', '1 large piece'],
  ['PORTS', '1 small portion'],
  ['PORTM', '1 medium portion'],
  ['PORTL', '1 large portion'],
  ['DL', '1 dl'],
  ['RKL', '1 tbsp'],
  ['TL', '1 tsp'],
];
/** The typical portion: the product's own piece, a piece, a medium portion */
const TYPICAL = ['KPL_VALM', 'KPL_M', 'PORTM'];

/**
 * Food use classes that are mixed dishes. Fineli's DISH type means "a
 * recipe", which includes breads and porridges, so GRIT's dish is a recipe
 * in one of these.
 */
const DISH_CLASSES = new Set([
  'MEATDISH',
  'POULTDIS',
  'OFFALDI',
  'FISHDISH',
  'SEAFDISH',
  'EGGMIX',
  'LEGUDISH',
  'POTADISH',
  'VEGDISH',
  'MUSHRDI',
  'PIZZA',
  'SANDWICH',
  'SALADMIX',
  'SALADMAY',
  'MEATSOUP',
  'POULTSOU',
  'FISHSOUP',
  'SEAFSOUP',
  'LEGUSOUP',
  'VEGSOUP',
  'MEATSAUC',
  'POULSAUC',
  'FISHSAUC',
  'SEAFSAUC',
  'LEGUSAUC',
  'BABMEATD',
  'BABFISHD',
]);
/** Not foods: the one dietary supplement */
const NOT_FOOD_CLASSES = new Set(['SPECSUPP']);

/** A food's units (code → grams) as servings, one typical. */
export function fineliServings(
  units: ReadonlyMap<string, number>,
): NonNullable<FoodRecord['servings']> {
  const typical = TYPICAL.find((u) => (units.get(u) ?? 0) > 0);
  return UNITS.filter(([code]) => (units.get(code) ?? 0) > 0).map(
    ([code, label]) => ({
      label,
      grams: units.get(code)!,
      typical: code === typical,
    }),
  );
}

/** Fineli's release as records: reads the files it needs from the zip. */
export async function fineliRecords(archive: Archive): Promise<FoodRecord[]> {
  const read = async (name: string) =>
    csvObjects(await archive.open(name), CSV);

  const names: Record<'EN' | 'FI' | 'SV', Map<string, string>> = {
    EN: new Map(),
    FI: new Map(),
    SV: new Map(),
  };
  for (const lang of ['EN', 'FI', 'SV'] as const) {
    for await (const r of await read(`foodname_${lang}.csv`)) {
      names[lang].set(r.FOODID, sentenceCase(r.FOODNAME ?? ''));
    }
  }
  const useClasses = new Map<string, string>();
  for await (const r of await read('fuclass_EN.csv')) {
    useClasses.set(r.THSCODE, (r.DESCRIPT ?? '').trim());
  }

  const values = new Map<string, Map<string, number>>();
  for await (const r of await read('component_value.csv')) {
    if (!FINELI_COMPONENTS.has(r.EUFDNAME)) continue;
    const v = fineliNumber(r.BESTLOC);
    if (v === undefined) continue;
    let food = values.get(r.FOODID);
    if (!food) values.set(r.FOODID, (food = new Map<string, number>()));
    food.set(r.EUFDNAME, v);
  }

  const units = new Map<string, Map<string, number>>();
  for await (const r of await read('foodaddunit.csv')) {
    const grams = fineliNumber(r.MASS);
    if (grams === undefined) continue;
    let food = units.get(r.FOODID);
    if (!food) units.set(r.FOODID, (food = new Map<string, number>()));
    food.set(r.FOODUNIT, grams);
  }

  const records: FoodRecord[] = [];
  for await (const r of await read('food.csv')) {
    const id = (r.FOODID ?? '').trim();
    if (
      !id ||
      r.FOODTYPE === 'SUPPLE' ||
      NOT_FOOD_CLASSES.has(r.FUCLASS ?? '')
    ) {
      continue;
    }
    const other = (['FI', 'SV'] as const)
      .map((lang) => ({
        name: names[lang].get(id) ?? '',
        lang: lang.toLowerCase(),
      }))
      .filter((n) => n.name);
    records.push({
      source: 'fineli',
      externalId: id,
      fetchedAt: FINELI_RELEASE,
      // Every food has an English name; the Finnish one if not
      name: names.EN.get(id) || names.FI.get(id) || '',
      kind:
        r.FOODTYPE === 'DISH' && DISH_CLASSES.has(r.FUCLASS ?? '')
          ? 'dish'
          : 'generic',
      category: useClasses.get(r.FUCLASS) ?? null,
      countries: ['fi'],
      servings: fineliServings(units.get(id) ?? new Map<string, number>()),
      nutrients: fineliNutrients(values.get(id) ?? new Map<string, number>()),
      basis: 'measured',
      names: other,
      quality: 1,
      verified: true,
    });
  }
  return records;
}
