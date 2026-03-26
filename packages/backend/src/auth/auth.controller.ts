import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { UsersService } from '../users/users.service';

@Controller('auth')
export class AuthController {
  constructor(private users: UsersService) {}

  /**
   * Called immediately after Supabase auth (login or signup).
   * Creates the user row in our DB if it doesn't exist yet.
   */
  @Post('sync')
  @UseGuards(AuthGuard)
  async sync(
    @CurrentUser() user: { supabaseId: string; email?: string },
    @Body() body: { displayName?: string } = {},
  ) {
    return this.users.upsertUser(user.supabaseId, {
      displayName: body.displayName,
      email: user.email,
    });
  }
}
