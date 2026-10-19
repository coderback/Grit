import {
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { IsNotFuture } from '../common/validators';
import { ACTIVITY_TYPES } from './activity.constants';

export class CreateActivityLogDto {
  @IsIn(ACTIVITY_TYPES)
  activityType: string;

  // 0 is allowed for step-only entries synced from a health app
  @IsInt()
  @Min(0)
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

  @IsOptional()
  @IsIn(['manual', 'healthkit', 'health_connect'])
  source?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @IsNotFuture()
  loggedAt?: string;
}
