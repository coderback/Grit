import { Module } from '@nestjs/common';
import { ProgressController } from './progress.controller';
import { TrendsService } from './trends.service';
import { WeightService } from './weight.service';
import { AdaptiveService } from './adaptive.service';

@Module({
  controllers: [ProgressController],
  providers: [WeightService, TrendsService, AdaptiveService],
  exports: [WeightService, AdaptiveService],
})
export class ProgressModule {}
