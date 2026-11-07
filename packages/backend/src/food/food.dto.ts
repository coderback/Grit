import {
  Matches,
  IsInt,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { IsNotFuture } from '../common/validators';

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

export class CreateFoodLogDto {
  @IsString()
  @Length(1, 200)
  name: string;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  brand?: string;

  @IsOptional()
  @IsString()
  @Length(0, 32)
  barcode?: string;

  @IsIn(MEAL_TYPES)
  mealType: string;

  @IsNumber()
  @Min(0)
  @Max(20000)
  calories: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2000)
  proteinG?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2000)
  carbsG?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2000)
  fatG?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100000)
  servingQty?: number;

  // "g", "serving", or a portion's label such as "medium (350 ml), whole milk"
  @IsOptional()
  @IsString()
  @Length(1, 60)
  servingUnit?: string;

  // Caffeine (mg) and alcohol (g) in the amount eaten, if known
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5000)
  caffeineMg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  alcoholG?: number;

  // The database food it came from, and the grams eaten (Phase 7). With
  // both, the log keeps a snapshot of the amount's nutrients.
  @IsOptional()
  @IsString()
  @Length(1, 60)
  foodId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5000)
  grams?: number;

  @IsOptional()
  @IsISO8601({ strict: true })
  @IsNotFuture()
  loggedAt?: string;
}

/** Edits to a logged food. Every field is optional; the barcode can't change. */
export class UpdateFoodLogDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

  @IsOptional()
  @IsIn(MEAL_TYPES)
  mealType?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(20000)
  calories?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2000)
  proteinG?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2000)
  carbsG?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2000)
  fatG?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100000)
  servingQty?: number;

  // "g", "serving", or a portion's label such as "medium (350 ml), whole milk"
  @IsOptional()
  @IsString()
  @Length(1, 60)
  servingUnit?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @IsNotFuture()
  loggedAt?: string;
}

export class FoodSearchQueryDto {
  @IsOptional()
  @IsString()
  @Length(0, 100)
  q?: string;

  // From the phone's locale, e.g. "GB" and "en-GB": foods sold there rank higher
  @IsOptional()
  @Matches(/^[A-Z]{2}$/)
  country?: string;

  @IsOptional()
  @IsString()
  @Length(2, 20)
  lang?: string;
}

export class BarcodeQueryDto {
  @IsOptional()
  @Matches(/^[A-Z]{2}$/)
  country?: string;
}

/** A portion saved for one-tap re-logging: a food log without meal or time. */
export class SaveFavoriteDto {
  @IsString()
  @Length(1, 200)
  name: string;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  brand?: string;

  @IsOptional()
  @IsString()
  @Length(0, 32)
  barcode?: string;

  @IsNumber()
  @Min(0)
  @Max(20000)
  calories: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2000)
  proteinG?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2000)
  carbsG?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2000)
  fatG?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100000)
  servingQty?: number;

  // "g", "serving", or a portion's label such as "medium (350 ml), whole milk"
  @IsOptional()
  @IsString()
  @Length(1, 60)
  servingUnit?: string;

  // The database food and the portion's grams (Phase 7), so logging the
  // favourite again keeps its nutrients
  @IsOptional()
  @IsString()
  @Length(1, 60)
  foodId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5000)
  grams?: number;
}

/** What the user picked from a food search, or that they picked nothing. */
export class SearchEventDto {
  @IsString()
  @Length(1, 200)
  query: string;

  // The result's position (0-based) and name; both left out when nothing was picked
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  position?: number;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  pickedName?: string;

  // From the phone's locale, e.g. "GB" and "en-GB"
  @IsOptional()
  @Matches(/^[A-Z]{2}$/)
  country?: string;

  @IsOptional()
  @IsString()
  @Length(2, 20)
  lang?: string;

  // The picked result's database food, and how many results there were
  @IsOptional()
  @IsString()
  @Length(1, 60)
  pickedId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  resultCount?: number;
}
