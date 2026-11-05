import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
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
import { ACTIVITY_TYPES } from '../activity/activity.constants';
import { IsNotFuture } from '../common/validators';
import { METRIC_NAMES } from './heart-rate';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class HealthWorkoutDto {
  // The health app's own ID for the workout
  @IsString()
  @Length(1, 120)
  externalId: string;

  @IsIn(ACTIVITY_TYPES)
  activityType: string;

  @IsISO8601({ strict: true })
  @IsNotFuture()
  startedAt: string;

  @IsInt()
  @Min(1)
  @Max(1440)
  durationMin: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(20000)
  caloriesBurned?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(300000)
  steps?: number;

  // Average over the workout, from the watch
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(230)
  avgHeartRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000000)
  distanceM?: number;
}

/** One day's value of a recovery or cycle metric. */
export class HealthMetricDto {
  @Matches(DATE)
  date: string;

  @IsIn(METRIC_NAMES)
  metric: string;

  // HRV only: sdnn (Apple) or rmssd (Health Connect)
  @IsOptional()
  @IsIn(['sdnn', 'rmssd', ''])
  type?: string;

  @IsNumber()
  value: number;

  // The app or device that recorded it
  @IsOptional()
  @IsString()
  @Length(0, 80)
  device?: string;
}

export class HealthDayDto {
  @Matches(DATE)
  date: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200000)
  steps?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  sleepMinutes?: number;
}

export class HealthWeightDto {
  @Matches(DATE)
  date: string;

  @IsNumber()
  @Min(20)
  @Max(400)
  weightKg: number;
}

export class HealthImportDto {
  @IsIn(['healthkit', 'health_connect'])
  source: 'healthkit' | 'health_connect';

  @IsArray()
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @Type(() => HealthWorkoutDto)
  workouts: HealthWorkoutDto[] = [];

  @IsArray()
  @ArrayMaxSize(62)
  @ValidateNested({ each: true })
  @Type(() => HealthDayDto)
  days: HealthDayDto[] = [];

  @IsArray()
  @ArrayMaxSize(62)
  @ValidateNested({ each: true })
  @Type(() => HealthWeightDto)
  weights: HealthWeightDto[] = [];

  @IsArray()
  @ArrayMaxSize(600)
  @ValidateNested({ each: true })
  @Type(() => HealthMetricDto)
  metrics: HealthMetricDto[] = [];
}
