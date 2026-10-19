import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { IsISO8601, IsOptional } from 'class-validator';
import { CurrentUser } from '../common/current-user.decorator';
import { UtcOffset } from '../common/utc-offset.decorator';
import { SocialService } from './social.service';

class FeedQueryDto {
  // loggedAt of the last item already shown; returns older items
  @IsOptional()
  @IsISO8601({ strict: true })
  cursor?: string;
}

@Controller()
@UseGuards(AuthGuard)
export class SocialController {
  constructor(private social: SocialService) {}

  @Get('feed')
  getFeed(
    @CurrentUser() user: { supabaseId: string },
    @Query() query: FeedQueryDto,
  ) {
    return this.social.getFeed(user.supabaseId, query.cursor);
  }

  @Get('leaderboard/weekly')
  getLeaderboard(
    @CurrentUser() user: { supabaseId: string },
    @UtcOffset() offset: number,
  ) {
    return this.social.getWeeklyLeaderboard(user.supabaseId, offset);
  }

  @Post('follow/:userId')
  follow(
    @CurrentUser() user: { supabaseId: string },
    @Param('userId') targetId: string,
  ) {
    return this.social.follow(user.supabaseId, targetId);
  }

  @Delete('follow/:userId')
  unfollow(
    @CurrentUser() user: { supabaseId: string },
    @Param('userId') targetId: string,
  ) {
    return this.social.unfollow(user.supabaseId, targetId);
  }

  @Get('users/me/following')
  getFollowing(@CurrentUser() user: { supabaseId: string }) {
    return this.social.getFollowing(user.supabaseId);
  }

  @Get('users/me/followers')
  getFollowers(@CurrentUser() user: { supabaseId: string }) {
    return this.social.getFollowers(user.supabaseId);
  }

  @Get('users/:id/profile')
  getProfile(@Param('id') id: string) {
    return this.social.getPublicProfile(id);
  }
}
