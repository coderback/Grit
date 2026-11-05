import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { UtcOffset } from '../common/utc-offset.decorator';
import { WorkoutsService } from './workouts.service';
import {
  ParseSetsDto,
  PrepareWorkoutDto,
  SaveWorkoutDto,
  UpdateWorkoutDto,
  WorkoutListDto,
} from './workouts.dto';

type Me = { supabaseId: string };

@Controller('workouts')
@UseGuards(AuthGuard)
export class WorkoutsController {
  constructor(private workouts: WorkoutsService) {}

  /** Saves a finished workout. Safe to retry with the same clientId. */
  @Post()
  save(@CurrentUser() user: Me, @Body() body: SaveWorkoutDto) {
    return this.workouts.save(user.supabaseId, body);
  }

  @Get()
  list(@CurrentUser() user: Me, @Query() q: WorkoutListDto) {
    return this.workouts.list(user.supabaseId, q.limit ?? 20, q.before);
  }

  /** Last time's sets, records and today's targets for the exercises about to be done. */
  @Post('prepare')
  @HttpCode(200)
  prepare(
    @CurrentUser() user: Me,
    @Body() body: PrepareWorkoutDto,
    @UtcOffset() offset: number,
  ) {
    return this.workouts.prepare(user.supabaseId, body, offset);
  }

  /** "bench 80 for 8, 8, 7" → sets */
  @Post('parse')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  parse(
    @CurrentUser() user: Me,
    @Body() body: ParseSetsDto,
    @UtcOffset() offset: number,
  ) {
    return this.workouts.parse(user.supabaseId, body, offset);
  }

  @Get('exercises/:exerciseId/history')
  history(
    @CurrentUser() user: Me,
    @Param('exerciseId') exerciseId: string,
    @UtcOffset() offset: number,
  ) {
    return this.workouts.history(user.supabaseId, exerciseId, offset);
  }

  @Get(':id')
  detail(@CurrentUser() user: Me, @Param('id') id: string) {
    return this.workouts.detail(user.supabaseId, id);
  }

  @Put(':id')
  update(
    @CurrentUser() user: Me,
    @Param('id') id: string,
    @Body() body: UpdateWorkoutDto,
  ) {
    return this.workouts.update(user.supabaseId, id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: Me, @Param('id') id: string) {
    return this.workouts.remove(user.supabaseId, id);
  }
}
