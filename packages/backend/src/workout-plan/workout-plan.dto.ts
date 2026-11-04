import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ACTIVITY_TYPES } from '../activity/activity.constants';

export const WEEKDAYS = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const PLAN_LOCATIONS = ['home', 'gym'] as const;

export class PlanExerciseDto {
  @IsString()
  @Length(1, 80)
  name: string;

  // e.g. "3 × 12", "20 min easy", "45 s on / 15 s off"
  @IsString()
  @Length(0, 60)
  detail: string;
}

/** One day of the plan, as stored and as edited from the app. */
export class PlanDayContentDto {
  @IsBoolean()
  rest: boolean;

  @IsString()
  @Length(0, 60)
  title: string;

  @IsIn(ACTIVITY_TYPES)
  activityType: string;

  @IsInt()
  @Min(0)
  @Max(240)
  durationMin: number;

  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => PlanExerciseDto)
  exercises: PlanExerciseDto[];
}

export class PlanDayDto extends PlanDayContentDto {
  @IsIn(WEEKDAYS)
  day: Weekday;
}

export class GeneratePlanDto {
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(6)
  daysPerWeek?: number;

  @IsOptional()
  @IsIn(PLAN_LOCATIONS)
  location?: string;

  // Free-text request for the coach, e.g. "no running, knees are sore"
  @IsOptional()
  @IsString()
  @Length(1, 300)
  feedback?: string;
}
