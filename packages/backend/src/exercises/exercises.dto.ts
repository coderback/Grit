import { IsOptional, IsString, Length } from 'class-validator';

export class ExerciseSearchDto {
  @IsOptional()
  @IsString()
  @Length(0, 80)
  q?: string;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  muscle?: string;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  equipment?: string;
}
