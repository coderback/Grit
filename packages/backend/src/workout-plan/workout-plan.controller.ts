import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { UtcOffset } from '../common/utc-offset.decorator';
import { WorkoutPlanService } from './workout-plan.service';
import {
  GeneratePlanDto,
  PlanDayContentDto,
  WEEKDAYS,
  type Weekday,
} from './workout-plan.dto';

@Controller('workout-plan')
@UseGuards(AuthGuard)
export class WorkoutPlanController {
  constructor(private plans: WorkoutPlanService) {}

  /** The user's plan, or null if they don't have one yet. */
  @Get()
  get(@CurrentUser() user: { supabaseId: string }) {
    return this.plans.getPlan(user.supabaseId);
  }

  @Post('generate')
  generate(
    @CurrentUser() user: { supabaseId: string },
    @Body() body: GeneratePlanDto,
    @UtcOffset() offset: number,
  ) {
    return this.plans.generate(user.supabaseId, body, offset);
  }

  @Put('days/:day')
  updateDay(
    @CurrentUser() user: { supabaseId: string },
    @Param('day') day: string,
    @Body() body: PlanDayContentDto,
  ) {
    if (!WEEKDAYS.includes(day as Weekday)) {
      throw new BadRequestException(
        'day must be mon, tue, wed, thu, fri, sat or sun',
      );
    }
    return this.plans.updateDay(user.supabaseId, day as Weekday, body);
  }
}
