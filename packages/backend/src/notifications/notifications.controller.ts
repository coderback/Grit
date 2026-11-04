import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { NotificationsService } from './notifications.service';
import {
  ListNotificationsDto,
  MarkReadDto,
  RegisterPushTokenDto,
  UnregisterPushTokenDto,
} from './notifications.dto';

type Me = { supabaseId: string };

@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  /** The inbox, newest first, with the number still unread. */
  @Get()
  list(@CurrentUser() user: Me, @Query() query: ListNotificationsDto) {
    return this.notifications.list(user.supabaseId, query.before);
  }

  @Get('unread-count')
  unread(@CurrentUser() user: Me) {
    return this.notifications.unreadCount(user.supabaseId);
  }

  @Post('read')
  markRead(@CurrentUser() user: Me, @Body() body: MarkReadDto) {
    return this.notifications.markRead(user.supabaseId, body.ids);
  }

  @Post('register')
  register(@CurrentUser() user: Me, @Body() body: RegisterPushTokenDto) {
    return this.notifications.registerToken(
      user.supabaseId,
      body.token,
      body.platform,
    );
  }

  @Delete('register')
  unregister(@CurrentUser() user: Me, @Body() body: UnregisterPushTokenDto) {
    return this.notifications.unregisterToken(user.supabaseId, body.token);
  }
}
