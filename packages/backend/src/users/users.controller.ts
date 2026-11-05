import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { UsersService } from './users.service';
import { UtcOffset } from '../common/utc-offset.decorator';
import { UpdateUserDto } from './users.dto';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private users: UsersService) {}

  @Get('me')
  async getMe(
    @CurrentUser() user: { supabaseId: string },
    @Headers('x-utc-offset') rawOffset: string | undefined,
    @UtcOffset() offset: number,
  ) {
    const me = await this.users.findBySupabaseId(user.supabaseId);
    // Remember the phone's time zone for scheduled alerts. Only when the app
    // actually sent one, so tools without the header don't reset it to UTC.
    if (rawOffset !== undefined && me.utcOffset !== offset) {
      return this.users.setUtcOffset(user.supabaseId, offset);
    }
    return me;
  }

  @Put('me')
  async updateMe(
    @CurrentUser() user: { supabaseId: string },
    @Body() body: UpdateUserDto,
    @UtcOffset() offset: number,
  ) {
    return this.users.updateUser(user.supabaseId, body, offset);
  }

  /**
   * Permission to send meal photos, descriptions and coach chats to Azure
   * OpenAI (Apple guideline 5.1.2(i)). AI features are refused without it.
   */
  @Post('me/ai-consent')
  grantAiConsent(@CurrentUser() user: { supabaseId: string }) {
    return this.users.setAiConsent(user.supabaseId, true);
  }

  @Delete('me/ai-consent')
  withdrawAiConsent(@CurrentUser() user: { supabaseId: string }) {
    return this.users.setAiConsent(user.supabaseId, false);
  }

  /** Deletes the account and all its data. Required by the App Store. */
  @Delete('me')
  @HttpCode(204)
  async deleteMe(@CurrentUser() user: { supabaseId: string }) {
    await this.users.deleteAccount(user.supabaseId);
  }
}
