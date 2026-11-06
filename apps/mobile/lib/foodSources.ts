/**
 * Where GRIT's food data comes from, with the credit and licence each source
 * asks for. Shown on Profile → Food data sources and linked from the
 * Nutrients screen. Edit the wording here.
 */
export interface FoodSource {
  /** The `source` code foods carry (fdc, off, cofid) */
  code: string;
  name: string;
  /** Who publishes it, or the attribution the licence asks for */
  credit: string;
  /** The notice the licence asks to be reproduced, if any */
  notice?: string;
  licence: string;
  /** The source's own site */
  url: string;
}

export const FOOD_SOURCES: FoodSource[] = [
  {
    code: 'fdc',
    name: 'USDA FoodData Central',
    credit: 'U.S. Department of Agriculture, Agricultural Research Service.',
    licence: 'Public domain',
    url: 'https://fdc.nal.usda.gov',
  },
  {
    code: 'off',
    name: 'Open Food Facts',
    credit: 'Product data from Open Food Facts (openfoodfacts.org), made available under the Open Database License (ODbL).',
    licence: 'Open Database License (ODbL)',
    url: 'https://world.openfoodfacts.org',
  },
  {
    code: 'cofid',
    name: 'UK CoFID',
    credit: "McCance and Widdowson's Composition of Foods Integrated Dataset, Public Health England / OHID.",
    notice: 'Contains public sector information licensed under the Open Government Licence v3.0.',
    licence: 'Open Government Licence v3.0',
    url: 'https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid',
  },
  // Canada's CNF, France's CIQUAL and Finland's Fineli join this list when
  // they're imported (see docs/ROADMAP.md, Phase 7)
];

/** "fdc.nal.usda.gov" from a source's URL, for its link text. */
export function siteName(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
}
