import { Module } from '@nestjs/common';
import { ProgressController } from './progress.controller';
import { TrendsService } from './trends.service';
import { WeightService } from './weight.service';

@Module({
  controllers: [ProgressController],
  providers: [WeightService, TrendsService],
  exports: [WeightService],
})
export class ProgressModule {}
