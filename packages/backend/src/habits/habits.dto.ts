import { IsOptional, IsString, Length } from 'class-validator';

export class CreateHabitDto {
  @IsOptional()
  @IsString()
  @Length(1, 60)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 16)
  emoji?: string;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  presetKey?: string;
}

export class UpdateHabitDto {
  @IsOptional()
  @IsString()
  @Length(1, 60)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 16)
  emoji?: string;
}
