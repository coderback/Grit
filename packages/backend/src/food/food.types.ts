import type { NutrientCode } from './nutrients';

export interface NormalizedFood {
  // The database food's id, or the Open Food Facts code for live results.
  // Never empty for a database food: the app treats '' as a manual entry.
  offId: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  calories: number; // per 100 g
  proteinG: number;
  carbsG: number;
  fatG: number;
  servingQty: number;
  servingUnit: string;
  imageUrl: string | null;
  /** Caffeine, mg per 100 g, when the label gives it */
  caffeineMg?: number;
  /** Alcohol, g per 100 g, from the label's % vol */
  alcoholG?: number;

  // Phase 7, from GRIT's own food database. All optional, so older app
  // builds keep working; live Open Food Facts results have none of them.
  foodId?: string;
  kind?: 'generic' | 'branded' | 'dish' | 'user';
  /** fdc | off | cofid | cnf | ciqual | fineli, or memory for Smart log's */
  source?: string;
  /** From a government table or a manufacturer's own data */
  verified?: boolean;
  basis?: 'measured' | 'label';
  /** Portions; labels carry no weight ("1 slice"), the app adds it */
  servings?: { label: string; grams: number; typical: boolean }[];
  /** Per 100 g, measured or label values only (single foods, not search) */
  nutrients?: Partial<Record<NutrientCode, number>>;
  /** The user has logged it before, or Smart log remembers it */
  mine?: boolean;
}

// OFF sometimes sends numbers as strings ("30"), so numeric fields accept both
type OFFNumber = number | string;

// Raw shape returned by the legacy search and product endpoints
export interface OFFProduct {
  id?: string;
  code?: string;
  product_name?: string;
  brands?: string;
  nutriments?: {
    'energy-kcal_100g'?: OFFNumber;
    'energy-kcal'?: OFFNumber;
    proteins_100g?: OFFNumber;
    carbohydrates_100g?: OFFNumber;
    fat_100g?: OFFNumber;
    caffeine_100g?: OFFNumber; // grams
    alcohol_100g?: OFFNumber; // % vol
  };
  serving_quantity?: OFFNumber;
  serving_quantity_unit?: string;
  image_small_url?: string;
}

// A hit from search-a-licious (search.openfoodfacts.org), where brands are a
// list of names rather than one comma-separated string.
export interface SearchHit extends Omit<OFFProduct, 'brands'> {
  brands?: string | string[];
}
