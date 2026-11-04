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
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../common/current-user.decorator';
import { UtcOffset } from '../common/utc-offset.decorator';
import { SocialService } from './social.service';

class FeedQueryDto {
  // `cursor` of the last item already shown; returns the items after it
  @IsOptional()
  @IsString()
  @MaxLength(100)
  cursor?: string;
}

class SearchQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  q?: string;
}

type Me = { supabaseId: string };

@Controller()
@UseGuards(AuthGuard)
export class SocialController {
  constructor(private social: SocialService) {}

  @Get('feed')
  getFeed(@CurrentUser() user: Me, @Query() query: FeedQueryDto) {
    return this.social.getFeed(user.supabaseId, query.cursor);
  }

  @Get('leaderboard/weekly')
  getLeaderboard(@CurrentUser() user: Me, @UtcOffset() offset: number) {
    return this.social.getWeeklyLeaderboard(user.supabaseId, offset);
  }

  /** Find people by username or name. */
  @Get('search/users')
  search(@CurrentUser() user: Me, @Query() query: SearchQueryDto) {
    return this.social.searchUsers(user.supabaseId, query.q ?? '');
  }

  // ── Following ───────────────────────────────────────────────────────────

  /** Returns `{ status: 'accepted' }`, or `'pending'` for a private account. */
  @Post('follow/:userId')
  follow(@CurrentUser() user: Me, @Param('userId') targetId: string) {
    return this.social.follow(user.supabaseId, targetId);
  }

  /** Unfollows, or cancels a pending request. */
  @Delete('follow/:userId')
  unfollow(@CurrentUser() user: Me, @Param('userId') targetId: string) {
    return this.social.unfollow(user.supabaseId, targetId);
  }

  @Get('follow-requests')
  getRequests(@CurrentUser() user: Me) {
    return this.social.getFollowRequests(user.supabaseId);
  }

  @Post('follow-requests/:userId/accept')
  accept(@CurrentUser() user: Me, @Param('userId') followerId: string) {
    return this.social.acceptFollowRequest(user.supabaseId, followerId);
  }

  @Delete('follow-requests/:userId')
  decline(@CurrentUser() user: Me, @Param('userId') followerId: string) {
    return this.social.declineFollowRequest(user.supabaseId, followerId);
  }

  @Delete('followers/:userId')
  removeFollower(@CurrentUser() user: Me, @Param('userId') followerId: string) {
    return this.social.removeFollower(user.supabaseId, followerId);
  }

  /** `:id` may be `me`. */
  @Get('users/:id/followers')
  getFollowers(@CurrentUser() user: Me, @Param('id') id: string) {
    return this.social.listConnections(user.supabaseId, id, 'followers');
  }

  @Get('users/:id/following')
  getFollowing(@CurrentUser() user: Me, @Param('id') id: string) {
    return this.social.listConnections(user.supabaseId, id, 'following');
  }

  @Get('users/:id/profile')
  getProfile(
    @CurrentUser() user: Me,
    @Param('id') id: string,
    @UtcOffset() offset: number,
  ) {
    return this.social.getProfile(user.supabaseId, id, offset);
  }

  // ── Blocking ────────────────────────────────────────────────────────────

  @Get('blocks')
  getBlocked(@CurrentUser() user: Me) {
    return this.social.getBlocked(user.supabaseId);
  }

  @Post('blocks/:userId')
  block(@CurrentUser() user: Me, @Param('userId') targetId: string) {
    return this.social.block(user.supabaseId, targetId);
  }

  @Delete('blocks/:userId')
  unblock(@CurrentUser() user: Me, @Param('userId') targetId: string) {
    return this.social.unblock(user.supabaseId, targetId);
  }
}
