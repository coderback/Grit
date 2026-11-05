import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { UtcOffset } from '../common/utc-offset.decorator';
import { HealthImportDto } from './health.dto';
import { HealthService } from './health.service';

type Me = { supabaseId: string };

@Controller('health')
@UseGuards(AuthGuard)
export class HealthController {
  constructor(private health: HealthService) {}

  /** Workouts, daily steps and sleep, weigh-ins and recovery metrics from the phone's health app. */
  @Post('import')
  import(
    @CurrentUser() user: Me,
    @Body() body: HealthImportDto,
    @UtcOffset() offset: number,
  ) {
    return this.health.import(user.supabaseId, body, offset);
  }

  @Get('recent')
  recent(@CurrentUser() user: Me, @UtcOffset() offset: number) {
    return this.health.recent(user.supabaseId, offset);
  }

  /** Whether cycle data is on, and how many days of it are stored. */
  @Get('cycle')
  cycle(@CurrentUser() user: Me) {
    return this.health.cycleSummary(user.supabaseId);
  }
}
