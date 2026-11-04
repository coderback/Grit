import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { UtcOffset } from '../common/utc-offset.decorator';
import { MealParseService } from './meal-parse.service';
import { LogParsedMealDto, ParseMealDto } from './meal-parse.dto';

@Controller('food')
@UseGuards(AuthGuard)
export class MealParseController {
  constructor(private meals: MealParseService) {}

  // The daily cap is the real limit; this stops a stuck retry loop
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('parse')
  parse(
    @CurrentUser() user: { supabaseId: string },
    @Body() body: ParseMealDto,
    @UtcOffset() offset: number,
  ) {
    return this.meals.parse(user.supabaseId, body, offset);
  }

  @Post('parse/log')
  log(
    @CurrentUser() user: { supabaseId: string },
    @Body() body: LogParsedMealDto,
  ) {
    return this.meals.log(user.supabaseId, body);
  }

  @Get('memories')
  memories(@CurrentUser() user: { supabaseId: string }) {
    return this.meals.listMemories(user.supabaseId);
  }

  @Delete('memories/:id')
  forget(@CurrentUser() user: { supabaseId: string }, @Param('id') id: string) {
    return this.meals.forget(user.supabaseId, id);
  }
}
