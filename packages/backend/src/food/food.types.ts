export interface NormalizedFood {
  offId: string;        // Open Food Facts product id / barcode
  name: string;
  brand: string | null;
  barcode: string | null;
  calories: number;     // per 100 g
  proteinG: number;
  carbsG: number;
  fatG: number;
  servingQty: number;
  servingUnit: string;
  imageUrl: string | null;
}

// Raw shape returned by Open Food Facts search endpoint
export interface OFFProduct {
  id?: string;
  code?: string;
  product_name?: string;
  brands?: string;
  nutriments?: {
    'energy-kcal_100g'?: number;
    'energy-kcal'?: number;
    proteins_100g?: number;
    carbohydrates_100g?: number;
    fat_100g?: number;
  };
  serving_quantity?: number;
  serving_quantity_unit?: string;
  image_small_url?: string;
}
