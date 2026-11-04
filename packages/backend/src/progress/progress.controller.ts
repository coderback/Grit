import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { UtcOffset } from '../common/utc-offset.decorator';
import { LogWeightDto, RangeQueryDto, WeightQueryDto } from './progress.dto';
import { TrendsService } from './trends.service';
import { WeightService } from './weight.service';

type Me = { supabaseId: string };

@Controller()
@UseGuards(AuthGuard)
export class ProgressController {
  constructor(
    private weight: WeightService,
    private trends: TrendsService,
  ) {}

  /** Weigh-ins for the last 30, 90 (default) or 365 days. */
  @Get('weight')
  history(
    @CurrentUser() user: Me,
    @Query() query: WeightQueryDto,
    @UtcOffset() offset: number,
  ) {
    return this.weight.history(user.supabaseId, query.days ?? 90, offset);
  }

  @Post('weight')
  log(
    @CurrentUser() user: Me,
    @Body() body: LogWeightDto,
    @UtcOffset() offset: number,
  ) {
    return this.weight.log(user.supabaseId, body.weightKg, offset, body.date);
  }

  @Delete('weight/:id')
  remove(@CurrentUser() user: Me, @Param('id') id: string) {
    return this.weight.remove(user.supabaseId, id);
  }

  /** Daily calories, protein, activity and weight for 7, 30 or 90 days. */
  @Get('stats/trends')
  getTrends(
    @CurrentUser() user: Me,
    @Query() query: RangeQueryDto,
    @UtcOffset() offset: number,
  ) {
    return this.trends.trends(user.supabaseId, query.days ?? 7, offset);
  }
}
