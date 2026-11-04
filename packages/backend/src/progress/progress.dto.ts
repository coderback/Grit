import { Type } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';

export const TREND_RANGES = [7, 30, 90] as const;

export class LogWeightDto {
  @IsNumber()
  @Min(20)
  @Max(400)
  weightKg: number;

  // The day weighed (YYYY-MM-DD); defaults to today
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  date?: string;
}

export class RangeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsIn(TREND_RANGES)
  days?: number;
}

export class WeightQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsIn([30, 90, 365])
  days?: number;
}
