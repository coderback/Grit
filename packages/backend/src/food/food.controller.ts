import {
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
import { FoodService } from './food.service';

@Controller()
@UseGuards(AuthGuard)
export class FoodController {
  constructor(private food: FoodService) {}

  // ── Food database search ─────────────────────────────────────────────────

  @Get('food/search')
  search(@Query('q') q: string) {
    return this.food.searchFoods(q ?? '');
  }

  @Get('food/barcode/:code')
  barcode(@Param('code') code: string) {
    return this.food.lookupBarcode(code);
  }

  // ── Food log CRUD ─────────────────────────────────────────────────────────

  @Post('food-logs')
  create(
    @CurrentUser() user: { supabaseId: string },
    @Body()
    body: {
      name: string;
      brand?: string;
      barcode?: string;
      mealType: string;
      calories: number;
      proteinG?: number;
      carbsG?: number;
      fatG?: number;
      servingQty?: number;
      servingUnit?: string;
      loggedAt?: string;
    },
  ) {
    return this.food.logFood(user.supabaseId, body);
  }

  @Get('food-logs')
  getByDate(
    @CurrentUser() user: { supabaseId: string },
    @Query('date') date: string,
  ) {
    const d = date ?? new Date().toISOString().split('T')[0];
    return this.food.getFoodLogsForDate(user.supabaseId, d);
  }

  @Delete('food-logs/:id')
  delete(
    @CurrentUser() user: { supabaseId: string },
    @Param('id') id: string,
  ) {
    return this.food.deleteFoodLog(user.supabaseId, id);
  }
}
