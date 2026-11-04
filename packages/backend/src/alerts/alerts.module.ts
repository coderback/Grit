import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { AlertsService } from './alerts.service';
import { ChallengesModule } from '../challenges/challenges.module';

@Module({
  imports: [NotificationsModule, ChallengesModule],
  providers: [AlertsService],
})
export class AlertsModule {}
