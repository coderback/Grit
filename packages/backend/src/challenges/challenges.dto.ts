import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { CHALLENGE_TYPES } from './challenge-rules';

export const CHALLENGE_DURATIONS = [3, 7, 14, 30] as const;

export class CreateChallengeDto {
  @IsString()
  @Length(1, 50)
  title: string;

  // Older app versions don't send it; their challenges were all steps
  @IsOptional()
  @IsIn(CHALLENGE_TYPES)
  type?: string;

  // Checked against the type's own limits in the service
  @IsInt()
  @Min(1)
  @Max(10_000_000)
  goalValue: number;

  @IsIn(CHALLENGE_DURATIONS)
  durationDays: number;
}
