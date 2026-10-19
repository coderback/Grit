import {
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
import { ActivityService } from './activity.service';
import { CreateActivityLogDto, UpdateActivityLogDto } from './activity.dto';

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

  // ?date= picks the week containing that date; defaults to this week
  @Get('week')
  getWeekly(
    @CurrentUser() user: { supabaseId: string },
    @Query() query: DateQueryDto,
    @UtcOffset() offset: number,
  ) {
    return this.activity.getWeeklySummary(user.supabaseId, offset, query.date);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: { supabaseId: string },
    @Param('id') id: string,
    @Body() body: UpdateActivityLogDto,
  ) {
    return this.activity.updateActivityLog(user.supabaseId, id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: { supabaseId: string }, @Param('id') id: string) {
    return this.activity.deleteActivityLog(user.supabaseId, id);
  }

  @Post(':id/kudos')
  kudos(@CurrentUser() user: { supabaseId: string }, @Param('id') id: string) {
    return this.activity.giveKudos(user.supabaseId, id);
  }
}
