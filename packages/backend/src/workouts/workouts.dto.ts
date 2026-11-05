import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ACTIVITY_TYPES } from '../activity/activity.constants';
import { IsNotFuture } from '../common/validators';

export class WorkoutSetDto {
  @IsString()
  @Length(1, 120)
  exerciseId: string;

  // 0 for a timed set
  @IsInt()
  @Min(0)
  @Max(100)
  reps: number;

  // Leave out (or null) for bodyweight
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(500)
  weightKg?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3600)
  durationSec?: number | null;

  // Effort, 6 (easy) to 10 (nothing left)
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  rpe?: number | null;

  @IsOptional()
  @IsBoolean()
  warmup?: boolean;

  // Sets sharing one are a superset or circuit
  @IsOptional()
  @IsString()
  @Length(1, 40)
  supersetId?: string | null;
}

/** A finished workout, sent whole from the phone. */
export class SaveWorkoutDto {
  // Made on the phone; sending the same one again doesn't log it twice
  @IsString()
  @Length(8, 64)
  clientId: string;

  // Which session of the plan this was (1, 2, 3…)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  planSession?: number;

  @IsOptional()
  @IsString()
  @Length(0, 60)
  title?: string;

  // strength_training unless it was a plan's run or ride, logged without sets
  @IsOptional()
  @IsIn(ACTIVITY_TYPES)
  activityType?: string;

  @IsISO8601({ strict: true })
  @IsNotFuture()
  startedAt: string;

  @IsISO8601({ strict: true })
  @IsNotFuture()
  endedAt: string;

  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => WorkoutSetDto)
  sets: WorkoutSetDto[];
}

/** Edits to a saved workout: what's given replaces what was there. */
export class UpdateWorkoutDto {
  @IsOptional()
  @IsString()
  @Length(0, 60)
  title?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @IsNotFuture()
  startedAt?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @IsNotFuture()
  endedAt?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => WorkoutSetDto)
  sets?: WorkoutSetDto[];
}

export class PrepareExerciseDto {
  @IsString()
  @Length(1, 120)
  exerciseId: string;

  // The plan's "3 × 8–12"; 3 × 8–12 when left out
  @IsOptional()
  @IsString()
  @Length(0, 60)
  detail?: string;
}

/** The exercises about to be done, to get last time's sets and today's targets. */
export class PrepareWorkoutDto {
  @IsArray()
  @ArrayMaxSize(16)
  @ValidateNested({ each: true })
  @Type(() => PrepareExerciseDto)
  exercises: PrepareExerciseDto[];
}

/** "bench 80 for 8, 8, 7", read into sets. */
export class ParseSetsDto {
  @IsString()
  @Length(1, 300)
  text: string;

  // The session's exercises, so names can be matched to them
  @IsArray()
  @ArrayMaxSize(16)
  @IsString({ each: true })
  @Length(1, 120, { each: true })
  exerciseIds: string[];
}

export class WorkoutListDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  // Sessions that started before this time, for paging
  @IsOptional()
  @IsISO8601({ strict: true })
  before?: string;
}
