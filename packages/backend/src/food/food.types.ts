export interface NormalizedFood {
  offId: string; // Open Food Facts product id / barcode
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
