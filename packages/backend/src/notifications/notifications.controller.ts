import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { RegisterPushTokenDto } from './notifications.dto';

@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Post('register')
  register(
    @CurrentUser() user: { supabaseId: string },
    @Body() body: RegisterPushTokenDto,
  ) {
    // platform is validated but not stored; Expo push tokens work for both
    return this.notifications.registerToken(user.supabaseId, body.token);
  }
}
