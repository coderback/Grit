import type { Readable } from 'stream';
import type {
  NutrientCode,
  NutrientValues,
} from '../../../backend/src/food/nutrients';
import type { Archive } from '../archive';
import type { FoodRecord } from '../record';

/**
 * France's CIQUAL: the ANSES-CIQUAL food composition table 2025 (ANSES;
 * Licence Ouverte / Etalab 2.0), as deposited by ANSES on Recherche Data
 * Gouv (doi:10.57745/RDMHWY), which answers servers when Ciqual's own site
 * doesn't.
 *
 * Flat UTF-8 XML files: alim (foods, French and English names, group
 * codes), alim_grp (group names) and compo (one row per food and
 * constituent, per 100 g). Values use a decimal comma; "-" is missing,
 * "traces" is a trace, "< 0,5" is below what the lab could measure.
 */

const DATAFILE_URL =
  'https://entrepot.recherche.data.gouv.fr/api/access/datafile/';

/** The files read, with Recherche Data Gouv's file ids and their SHA-256 */
export const CIQUAL_FILES = {
  alim: {
    name: 'alim_2025_11_03.xml',
    url: `${DATAFILE_URL}666252`,
    sha256: 'e0b1de25b3039028205e9d54a96892e403e1b313c2efeb41180fabe132627478',
  },
  groups: {
    name: 'alim_grp_2025_11_03.xml',
    url: `${DATAFILE_URL}666250`,
    sha256: 'e216928be1001aed15ba1b120405b70a98145da2a1a76026d6e33542bd5e39dc',
  },
  compo: {
    name: 'compo_2025_11_03.xml',
    url: `${DATAFILE_URL}666249`,
    sha256: '8c46a9032ece4eab4ffccc9dfcb0c490ec2f416aa664cc1ee013b241c6bdd4af',
  },
} as const;
/** Published on Recherche Data Gouv on 19 November 2025 */
export const CIQUAL_RELEASE = new Date('2025-11-19T00:00:00Z');

/** The files by name pattern, so a newer release's dated names are found */
export const CIQUAL_PATTERNS = {
  alim: /^alim_\d[\d_]*\.xml$/i,
  groups: /^alim_grp_\d[\d_]*\.xml$/i,
  compo: /^compo_\d[\d_]*\.xml$/i,
};

/** CIQUAL constituent codes for each GRIT code, first present wins. */
const CONSTITUENTS: readonly [NutrientCode, readonly number[]][] = [
  // EU Regulation 1169/2011 (what labels use), else N × Jones' factor
  ['kcal', [328, 333]],
  ['protein_g', [25000, 25003]],
  // Available carbohydrate (excludes fibre), as EU tables give it
  ['carbs_g', [31000]],
  ['sugars_g', [32000]],
  ['fat_g', [40000]],
  ['sat_fat_g', [40302]],
  ['fibre_g', [34100]],
  ['alcohol_g', [60000]],
  ['sodium_mg', [10110]],
  ['potassium_mg', [10190]],
  ['calcium_mg', [10200]],
  ['magnesium_mg', [10120]],
  ['phosphorus_mg', [10150]],
  ['iron_mg', [10260]],
  ['zinc_mg', [10300]],
  ['selenium_ug', [10340]],
  ['vit_a_ug', [51104]], // RAE
  ['vit_c_mg', [55100]],
  ['vit_d_ug', [52100]],
  // α-tocopherol, else vitamin E
  ['vit_e_mg', [71010, 53100]],
  ['vit_k_ug', [54101]], // K1, as USDA's
  ['b1_mg', [56100]],
  ['b2_mg', [56200]],
  ['b3_mg', [56310]],
  ['b6_mg', [56500]],
  ['b12_ug', [56600]],
  // DFE, else total folate
  ['folate_ug', [56702, 56700]],
];

const KJ = [327, 332];
const SALT_G = 10004;
const RETINOL = 51200;
const BETA_CAROTENE = 51330;

export const CIQUAL_CONSTITUENTS = new Set([
  ...CONSTITUENTS.flatMap(([, c]) => c),
  ...KJ,
  SALT_G,
  RETINOL,
  BETA_CAROTENE,
]);

/** CIQUAL values (constituent → amount per 100 g) in GRIT's codes and units. */
export function ciqualNutrients(
  values: ReadonlyMap<number, number>,
): NutrientValues {
  const out: NutrientValues = {};
  for (const [code, ids] of CONSTITUENTS) {
    for (const id of ids) {
      const v = values.get(id);
      if (v !== undefined) {
        out[code] = v;
        break;
      }
    }
  }
  if (out.kcal === undefined) {
    const kj = KJ.map((id) => values.get(id)).find((v) => v !== undefined);
    if (kj !== undefined) out.kcal = kj / 4.184;
  }
  // RAE from its parts when there's no total: retinol + β-carotene / 12
  const retinol = values.get(RETINOL);
  const carotene = values.get(BETA_CAROTENE);
  if (
    out.vit_a_ug === undefined &&
    retinol !== undefined &&
    carotene !== undefined
  ) {
    out.vit_a_ug = retinol + carotene / 12;
  }
  // 1 g salt has 400 mg sodium
  const salt = values.get(SALT_G);
  if (out.sodium_mg === undefined && salt !== undefined) {
    out.sodium_mg = salt * 400;
  }
  return out;
}

/**
 * A CIQUAL value: "59,7" is 59.7 and "traces" is 0. "-" (missing) and
 * "< 0,5" (below what the lab could measure, so unknown) are missing,
 * never zero.
 */
export function ciqualNumber(s: string | null | undefined): number | undefined {
  const t = (s ?? '').trim();
  if (/^traces$/i.test(t)) return 0;
  if (!/^-?\d+(?:,\d+)?$/.test(t)) return undefined;
  return Number(t.replace(',', '.'));
}

const ENTITIES: Record<string, string> = {
  lt: '<',
  gt: '>',
  amp: '&',
  apos: "'",
  quot: '"',
};

function decode(s: string) {
  return s.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code =
        e[1] === 'x' || e[1] === 'X'
          ? parseInt(e.slice(2), 16)
          : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** One element's children: name → trimmed text, null when marked missing. */
function fields(body: string) {
  const out: Record<string, string | null> = {};
  const re = /<(\w+)(?:\s[^>]*?)?(?:\/>|>([^<]*)<\/\1>)/g;
  for (let m = re.exec(body); m; m = re.exec(body)) {
    out[m[1]] = m[2] === undefined ? null : decode(m[2]).trim();
  }
  return out;
}

/**
 * The `<tag>` records of a flat XML table (CIQUAL's: one level of
 * elements holding text), streamed so the 69 MB compo file never has to
 * be in memory at once.
 */
export async function* xmlRecords(
  input: Readable,
  tag: string,
): AsyncGenerator<Record<string, string | null>> {
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  let buffer = '';
  input.setEncoding('utf8');
  for await (const chunk of input) {
    buffer += chunk as string;
    let from = 0;
    for (
      let end = buffer.indexOf(close, from);
      end >= 0;
      end = buffer.indexOf(close, from)
    ) {
      const start = buffer.lastIndexOf(open, end);
      if (start >= from) yield fields(buffer.slice(start + open.length, end));
      from = end + close.length;
    }
    buffer = buffer.slice(from);
  }
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "01" is starters and dishes */
const DISH_GROUP = '01';

/** CIQUAL's foods as records, from an archive holding its XML files. */
export async function ciqualRecords(archive: Archive): Promise<FoodRecord[]> {
  const file = (key: keyof typeof CIQUAL_PATTERNS) => {
    const name = archive.find(CIQUAL_PATTERNS[key]);
    if (!name) throw new Error(`${archive.path} has no CIQUAL ${key} file`);
    return name;
  };

  const groups = new Map<string, string>();
  for await (const r of xmlRecords(
    await archive.open(file('groups')),
    'ALIM_GRP',
  )) {
    const name = r.alim_ssgrp_nom_eng;
    if (r.alim_ssgrp_code && name && name !== '-') {
      groups.set(r.alim_ssgrp_code, capitalise(name));
    }
    if (r.alim_grp_code && r.alim_grp_nom_eng && !groups.has(r.alim_grp_code)) {
      groups.set(r.alim_grp_code, capitalise(r.alim_grp_nom_eng));
    }
  }

  const values = new Map<string, Map<number, number>>();
  for await (const r of xmlRecords(
    await archive.open(file('compo')),
    'COMPO',
  )) {
    const constituent = Number(r.const_code);
    if (!r.alim_code || !CIQUAL_CONSTITUENTS.has(constituent)) continue;
    const v = ciqualNumber(r.teneur);
    if (v === undefined) continue;
    let food = values.get(r.alim_code);
    if (!food) values.set(r.alim_code, (food = new Map<number, number>()));
    food.set(constituent, v);
  }

  const records: FoodRecord[] = [];
  for await (const r of xmlRecords(await archive.open(file('alim')), 'ALIM')) {
    const code = r.alim_code;
    if (!code) continue;
    const french = r.alim_nom_fr ?? '';
    const group = r.alim_grp_code ?? '';
    records.push({
      source: 'ciqual',
      externalId: code,
      fetchedAt: CIQUAL_RELEASE,
      name: r.alim_nom_eng || french,
      kind: group === DISH_GROUP ? 'dish' : 'generic',
      category:
        groups.get(r.alim_ssgrp_code ?? '') ?? groups.get(group) ?? null,
      countries: ['fr'],
      nutrients: ciqualNutrients(values.get(code) ?? new Map<number, number>()),
      basis: 'measured',
      names: french ? [{ name: french, lang: 'fr' }] : [],
      quality: 1,
      verified: true,
    });
  }
  return records;
}
