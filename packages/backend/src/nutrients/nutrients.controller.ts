import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { UtcOffset } from '../common/utc-offset.decorator';
import { DateQueryDto } from '../common/dto';
import { localToday } from '../common/day';
import { NutrientsService } from './nutrients.service';

type Me = { supabaseId: string };

@Controller()
@UseGuards(AuthGuard)
export class NutrientsController {
  constructor(private nutrients: NutrientsService) {}

  /** A day's nutrients against targets, with how much of its calories have data. */
  @Get('nutrients/day')
  day(
    @CurrentUser() user: Me,
    @Query() query: DateQueryDto,
    @UtcOffset() offset: number,
  ) {
    return this.nutrients.day(
      user.supabaseId,
      query.date ?? localToday(offset),
      offset,
    );
  }

  /** Nutrients low on most judged days of the Mon–Sun week containing ?date= (default: this week). */
  @Get('nutrients/week')
  week(
    @CurrentUser() user: Me,
    @Query() query: DateQueryDto,
    @UtcOffset() offset: number,
  ) {
    return this.nutrients.week(user.supabaseId, offset, query.date);
  }
}
