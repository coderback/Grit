import {
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

  @IsOptional()
  @IsString()
  @Length(1, 20)
  servingUnit?: string;

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

  @IsOptional()
  @IsString()
  @Length(1, 20)
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
}
