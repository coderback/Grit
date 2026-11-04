import { Module } from '@nestjs/common';
import { SocialService } from './social.service';
import { SocialController } from './social.controller';
import { PrivacyService } from './privacy.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [SocialService, PrivacyService],
  controllers: [SocialController],
  exports: [SocialService, PrivacyService],
})
export class SocialModule {}
