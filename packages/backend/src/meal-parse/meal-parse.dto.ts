import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { MEAL_TYPES } from '../food/food.dto';
import { IsNotFuture } from '../common/validators';

export class ParseMealDto {
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  text?: string;

  // A JPEG, PNG or WebP photo as base64 (no data: prefix). The app resizes
  // to about 1024 px first, so real photos are a few hundred kB.
  @IsOptional()
  @IsString()
  @Length(1, 4_000_000)
  @Matches(/^[A-Za-z0-9+/=\s]+$/, { message: 'imageBase64 must be base64' })
  imageBase64?: string;

  @IsOptional()
  @IsIn(['image/jpeg', 'image/png', 'image/webp'])
  imageType?: string;
}

export class ConfirmedItemDto {
  @IsString()
  @Length(1, 200)
  name: string;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  brand?: string;

  @IsNumber()
  @Min(1)
  @Max(5000)
  grams: number;

  @IsNumber()
  @Min(0)
  @Max(900)
  kcalPer100g: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  proteinPer100g: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  carbsPer100g: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  fatPer100g: number;

  // Off for a one-off, so it doesn't become "your usual"
  @IsOptional()
  @IsBoolean()
  remember?: boolean;
}

export class LogParsedMealDto {
  @IsIn(MEAL_TYPES)
  mealType: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @IsNotFuture()
  loggedAt?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ConfirmedItemDto)
  items: ConfirmedItemDto[];
}
