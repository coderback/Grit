import { Module } from '@nestjs/common';
import { ProgressModule } from '../progress/progress.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [ProgressModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
