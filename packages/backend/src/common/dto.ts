import { IsISO8601, IsOptional, Matches } from 'class-validator';

/** Query string `?date=YYYY-MM-DD`; defaults to the user's local today. */
export class DateQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  date?: string;
}
