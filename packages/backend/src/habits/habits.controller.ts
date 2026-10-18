import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { UtcOffset } from '../common/utc-offset.decorator';
import { HabitsService } from './habits.service';
import { CreateHabitDto, UpdateHabitDto } from './habits.dto';

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
  remove(
    @CurrentUser() user: { supabaseId: string },
    @Param('id') id: string,
  ) {
    return this.habits.deleteHabit(user.supabaseId, id);
  }

  @Post(':id/log')
  log(
    @CurrentUser() user: { supabaseId: string },
    @Param('id') id: string,
    @UtcOffset() offset: number,
  ) {
    return this.habits.logHabit(user.supabaseId, id, offset);
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
