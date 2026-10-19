import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Patch,
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
import {
  CreateFoodLogDto,
  FoodSearchQueryDto,
  UpdateFoodLogDto,
} from './food.dto';

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

  // ?date= picks the week containing that date; defaults to this week
  @Get('food-logs/week')
  getWeekly(
    @CurrentUser() user: { supabaseId: string },
    @Query() query: DateQueryDto,
    @UtcOffset() offset: number,
  ) {
    return this.food.getWeeklySummary(user.supabaseId, offset, query.date);
  }

  @Patch('food-logs/:id')
  update(
    @CurrentUser() user: { supabaseId: string },
    @Param('id') id: string,
    @Body() body: UpdateFoodLogDto,
  ) {
    return this.food.updateFoodLog(user.supabaseId, id, body);
  }

  @Delete('food-logs/:id')
  delete(@CurrentUser() user: { supabaseId: string }, @Param('id') id: string) {
    return this.food.deleteFoodLog(user.supabaseId, id);
  }
}
