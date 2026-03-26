import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { ActivityService } from './activity.service';

@Controller('activity-logs')
@UseGuards(AuthGuard)
export class ActivityController {
  constructor(private activity: ActivityService) {}

  @Get('types')
  getTypes() {
    return this.activity.getActivityTypes();
  }

  @Post()
  create(
    @CurrentUser() user: { supabaseId: string },
    @Body()
    body: {
      activityType: string;
      durationMin: number;
      caloriesBurned?: number;
      steps?: number;
      source?: string;
      loggedAt?: string;
    },
  ) {
    return this.activity.logActivity(user.supabaseId, body);
  }

  @Get()
  getByDate(
    @CurrentUser() user: { supabaseId: string },
    @Query('date') date: string,
  ) {
    const d = date ?? new Date().toISOString().split('T')[0];
    return this.activity.getActivityLogsForDate(user.supabaseId, d);
  }

  @Get('week')
  getWeekly(@CurrentUser() user: { supabaseId: string }) {
    return this.activity.getWeeklySummary(user.supabaseId);
  }

  @Post(':id/kudos')
  kudos(
    @CurrentUser() user: { supabaseId: string },
    @Param('id') id: string,
  ) {
    return this.activity.giveKudos(user.supabaseId, id);
  }
}
