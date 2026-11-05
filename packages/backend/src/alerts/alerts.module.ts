import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { AlertsService } from './alerts.service';
import { ChallengesModule } from '../challenges/challenges.module';
import { ProgressModule } from '../progress/progress.module';

@Module({
  imports: [NotificationsModule, ChallengesModule, ProgressModule],
  providers: [AlertsService],
})
export class AlertsModule {}
