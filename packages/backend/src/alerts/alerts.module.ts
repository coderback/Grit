import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { AlertsService } from './alerts.service';

@Module({
  imports: [NotificationsModule],
  providers: [AlertsService],
})
export class AlertsModule {}
