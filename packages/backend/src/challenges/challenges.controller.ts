import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { UtcOffset } from '../common/utc-offset.decorator';
import { ChallengesService } from './challenges.service';
import { CreateChallengeDto, UpdateProgressDto } from './challenges.dto';

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

  @Put(':id/progress')
  updateProgress(
    @CurrentUser() user: { supabaseId: string },
    @Param('id') id: string,
    @Body() body: UpdateProgressDto,
  ) {
    return this.challenges.updateProgress(user.supabaseId, id, body.steps);
  }
}
