import { IsIn, IsInt, IsString, Length, Max, Min } from 'class-validator';

export const CHALLENGE_DURATIONS = [3, 7, 14, 30] as const;

export class CreateChallengeDto {
  @IsString()
  @Length(1, 50)
  title: string;

  @IsInt()
  @Min(1000)
  @Max(10_000_000)
  goalValue: number;

  @IsIn(CHALLENGE_DURATIONS)
  durationDays: number;
}

export class UpdateProgressDto {
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  steps: number;
}
