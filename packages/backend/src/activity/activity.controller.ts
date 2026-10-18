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
import { UtcOffset } from '../common/utc-offset.decorator';
import { DateQueryDto } from '../common/dto';
import { localToday } from '../common/day';
import { ActivityService } from './activity.service';
import { CreateActivityLogDto } from './activity.dto';

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
    @Body() body: CreateActivityLogDto,
  ) {
    return this.activity.logActivity(user.supabaseId, body);
  }

  @Get()
  getByDate(
    @CurrentUser() user: { supabaseId: string },
    @Query() query: DateQueryDto,
    @UtcOffset() offset: number,
  ) {
    const date = query.date ?? localToday(offset);
    return this.activity.getActivityLogsForDate(user.supabaseId, date, offset);
  }

  @Get('week')
  getWeekly(
    @CurrentUser() user: { supabaseId: string },
    @UtcOffset() offset: number,
  ) {
    return this.activity.getWeeklySummary(user.supabaseId, offset);
  }

  @Post(':id/kudos')
  kudos(
    @CurrentUser() user: { supabaseId: string },
    @Param('id') id: string,
  ) {
    return this.activity.giveKudos(user.supabaseId, id);
  }
}
