import {
  Controller, Get, Post, Delete, Param, Query, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { SocialService } from './social.service';

@Controller()
@UseGuards(AuthGuard)
export class SocialController {
  constructor(private social: SocialService) {}

  @Get('feed')
  getFeed(
    @CurrentUser() user: { supabaseId: string },
    @Query('cursor') cursor?: string,
  ) {
    return this.social.getFeed(user.supabaseId, cursor);
  }

  @Get('leaderboard/weekly')
  getLeaderboard(@CurrentUser() user: { supabaseId: string }) {
    return this.social.getWeeklyLeaderboard(user.supabaseId);
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
