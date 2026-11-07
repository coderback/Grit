/**
 * Where GRIT's food data comes from, with the credit and licence each source
 * asks for. Shown on Profile → Food data sources and linked from the
 * Nutrients screen. Edit the wording here.
 */
export interface FoodSource {
  /** The `source` code foods carry (fdc, off, cofid, cnf, ciqual, fineli) */
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
  {
    code: 'cnf',
    name: 'Canadian Nutrient File',
    credit: 'Canadian Nutrient File 2015, Health Canada.',
    notice: 'Contains information licensed under the Open Government Licence – Canada.',
    licence: 'Open Government Licence – Canada',
    url: 'https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data.html',
  },
  {
    code: 'ciqual',
    name: 'ANSES-CIQUAL',
    credit: 'ANSES-CIQUAL French food composition table, 2025 version (Anses), last updated 19 November 2025.',
    licence: 'Licence Ouverte / Open Licence 2.0 (Etalab)',
    url: 'https://ciqual.anses.fr',
  },
  {
    code: 'fineli',
    name: 'Fineli',
    credit: 'Finnish Institute for Health and Welfare (THL), Fineli, the Finnish food composition database, release 20.',
    licence: 'Creative Commons Attribution 4.0 (CC BY 4.0)',
    url: 'https://fineli.fi',
  },
];

/** "fdc.nal.usda.gov" from a source's URL, for its link text. */
export function siteName(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
}
