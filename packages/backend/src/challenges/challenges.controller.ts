import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { UtcOffset } from '../common/utc-offset.decorator';
import { ChallengesService } from './challenges.service';
import { CreateChallengeDto } from './challenges.dto';

@Controller('challenges')
@UseGuards(AuthGuard)
export class ChallengesController {
  constructor(private challenges: ChallengesService) {}

  @Post()
  create(
    @CurrentUser() user: { supabaseId: string },
    @Body() body: CreateChallengeDto,
    @UtcOffset() offset: number,
  ) {
    return this.challenges.createChallenge(user.supabaseId, body, offset);
  }

  @Get()
  getMine(@CurrentUser() user: { supabaseId: string }) {
    return this.challenges.getUserChallenges(user.supabaseId);
  }

  @Get(':id')
  getOne(@CurrentUser() user: { supabaseId: string }, @Param('id') id: string) {
    return this.challenges.getChallenge(user.supabaseId, id);
  }

  @Post('join/:inviteCode')
  join(
    @CurrentUser() user: { supabaseId: string },
    @Param('inviteCode') code: string,
  ) {
    return this.challenges.joinByInviteCode(user.supabaseId, code);
  }

  /** Progress comes from logged workouts, so there's no endpoint to set it. */
  @Delete(':id/participants/me')
  leave(@CurrentUser() user: { supabaseId: string }, @Param('id') id: string) {
    return this.challenges.leave(user.supabaseId, id);
  }

  /** Creator only. */
  @Delete(':id')
  remove(@CurrentUser() user: { supabaseId: string }, @Param('id') id: string) {
    return this.challenges.remove(user.supabaseId, id);
  }
}
