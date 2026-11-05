import { Module } from '@nestjs/common';
import { azureOpenAIProviders } from '../ai/azure-openai';
import { ProgressModule } from '../progress/progress.module';
import { WorkoutsController } from './workouts.controller';
import { WorkoutsService } from './workouts.service';

@Module({
  imports: [ProgressModule],
  controllers: [WorkoutsController],
  providers: [...azureOpenAIProviders, WorkoutsService],
  exports: [WorkoutsService],
})
export class WorkoutsModule {}
