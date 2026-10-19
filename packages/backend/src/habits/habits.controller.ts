import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { UtcOffset } from '../common/utc-offset.decorator';
import { HabitsService } from './habits.service';
import { CreateHabitDto, HabitDayDto, UpdateHabitDto } from './habits.dto';

@Controller('habits')
@UseGuards(AuthGuard)
export class HabitsController {
  constructor(private habits: HabitsService) {}

  @Get('presets')
  getPresets() {
    return this.habits.getPresets();
  }

  @Get()
  getAll(@CurrentUser() user: { supabaseId: string }) {
    return this.habits.getHabits(user.supabaseId);
  }

  @Post()
  create(
    @CurrentUser() user: { supabaseId: string },
    @Body() body: CreateHabitDto,
  ) {
    return this.habits.createHabit(user.supabaseId, body);
  }

  @Put(':id')
  update(
    @CurrentUser() user: { supabaseId: string },
    @Param('id') id: string,
    @Body() body: UpdateHabitDto,
  ) {
    return this.habits.updateHabit(user.supabaseId, id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: { supabaseId: string }, @Param('id') id: string) {
    return this.habits.deleteHabit(user.supabaseId, id);
  }

  // Streaks for every active habit in one request
  @Get('streaks')
  streaks(
    @CurrentUser() user: { supabaseId: string },
    @UtcOffset() offset: number,
  ) {
    return this.habits.getAllStreaks(user.supabaseId, offset);
  }

  // ?date= back-fills an earlier day (up to 30 days); defaults to today
  @Post(':id/log')
  log(
    @CurrentUser() user: { supabaseId: string },
    @Param('id') id: string,
    @Query() query: HabitDayDto,
    @UtcOffset() offset: number,
  ) {
    return this.habits.logHabit(user.supabaseId, id, offset, query.date);
  }

  @Delete(':id/log')
  unlog(
    @CurrentUser() user: { supabaseId: string },
    @Param('id') id: string,
    @Query() query: HabitDayDto,
    @UtcOffset() offset: number,
  ) {
    return this.habits.unlogHabit(user.supabaseId, id, offset, query.date);
  }

  @Get(':id/streak')
  streak(
    @CurrentUser() user: { supabaseId: string },
    @Param('id') id: string,
    @UtcOffset() offset: number,
  ) {
    return this.habits.getStreak(user.supabaseId, id, offset);
  }
}
