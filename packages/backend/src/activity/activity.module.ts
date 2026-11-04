import { Module } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { ActivityController } from './activity.controller';
import { SocialModule } from '../social/social.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [SocialModule, NotificationsModule],
  providers: [ActivityService],
  controllers: [ActivityController],
  exports: [ActivityService],
})
export class ActivityModule {}
