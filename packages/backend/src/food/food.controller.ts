import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { UtcOffset } from '../common/utc-offset.decorator';
import { DateQueryDto } from '../common/dto';
import { localToday } from '../common/day';
import { FoodService } from './food.service';
import { CreateFoodLogDto, FoodSearchQueryDto } from './food.dto';

@Controller()
@UseGuards(AuthGuard)
export class FoodController {
  constructor(private food: FoodService) {}

  // ── Food database search ─────────────────────────────────────────────────

  @Get('food/search')
  search(@Query() query: FoodSearchQueryDto) {
    return this.food.searchFoods(query.q ?? '');
  }

  @Get('food/barcode/:code')
  barcode(@Param('code') code: string) {
    if (!/^\d{6,14}$/.test(code)) {
      throw new BadRequestException('Barcode must be 6–14 digits');
    }
    return this.food.lookupBarcode(code);
  }

  // ── Food log CRUD ─────────────────────────────────────────────────────────

  @Post('food-logs')
  create(
    @CurrentUser() user: { supabaseId: string },
    @Body() body: CreateFoodLogDto,
  ) {
    return this.food.logFood(user.supabaseId, body);
  }

  @Get('food-logs')
  getByDate(
    @CurrentUser() user: { supabaseId: string },
    @Query() query: DateQueryDto,
    @UtcOffset() offset: number,
  ) {
    const date = query.date ?? localToday(offset);
    return this.food.getFoodLogsForDate(user.supabaseId, date, offset);
  }

  @Get('food-logs/week')
  getWeekly(
    @CurrentUser() user: { supabaseId: string },
    @UtcOffset() offset: number,
  ) {
    return this.food.getWeeklySummary(user.supabaseId, offset);
  }

  @Delete('food-logs/:id')
  delete(@CurrentUser() user: { supabaseId: string }, @Param('id') id: string) {
    return this.food.deleteFoodLog(user.supabaseId, id);
  }
}
