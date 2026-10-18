import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  Min,
} from 'class-validator';

export const PRIMARY_GOALS = [
  'lose_weight',
  'build_muscle',
  'maintain',
  'recomp',
  'build_strength',
  'build_habits',
  'just_track',
] as const;

export const ACTIVITY_LEVELS = [
  'sedentary',
  'lightly_active',
  'active',
  'very_active',
] as const;

export const GENDERS = ['male', 'female', 'other'] as const;

/** Fields a user may change on their own profile. Anything else is rejected. */
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Length(1, 50)
  displayName?: string;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  avatarUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(800)
  @Max(10000)
  calorieGoal?: number;

  @IsOptional()
  @IsNumber()
  @Min(20)
  @Max(400)
  weightKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(50)
  @Max(300)
  heightCm?: number;

  @IsOptional()
  @IsIn(PRIMARY_GOALS)
  primaryGoal?: string;

  @IsOptional()
  @IsIn(ACTIVITY_LEVELS)
  activityLevel?: string;

  @IsOptional()
  @IsIn(GENDERS)
  gender?: string;

  // Accepts a date ("1990-01-01") or a full timestamp; stored as a DateTime
  @IsOptional()
  @IsISO8601({ strict: true })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? `${value}T00:00:00.000Z`
      : value,
  )
  dateOfBirth?: string;
}

export class SyncUserDto {
  @IsOptional()
  @IsString()
  @Length(1, 50)
  displayName?: string;
}
