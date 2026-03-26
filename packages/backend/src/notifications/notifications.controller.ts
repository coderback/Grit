import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Post('register')
  register(
    @CurrentUser() user: { supabaseId: string },
    @Body() body: { token: string; platform: string },
  ) {
    return this.notifications.registerToken(user.supabaseId, body.token, body.platform);
  }
}
