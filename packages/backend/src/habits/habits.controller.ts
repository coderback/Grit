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
import { HabitsService } from './habits.service';

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
    @Body() body: { name?: string; emoji?: string; presetKey?: string },
  ) {
    return this.habits.createHabit(user.supabaseId, body);
  }

  @Put(':id')
  update(
    @CurrentUser() user: { supabaseId: string },
    @Param('id') id: string,
    @Body() body: { name?: string; emoji?: string },
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
  ) {
    return this.habits.logHabit(user.supabaseId, id);
  }

  @Get(':id/streak')
  streak(
    @CurrentUser() user: { supabaseId: string },
    @Param('id') id: string,
  ) {
    return this.habits.getStreak(user.supabaseId, id);
  }
}
