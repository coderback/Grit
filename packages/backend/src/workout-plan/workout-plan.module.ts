import { Module } from '@nestjs/common';
import { azureOpenAIProviders } from '../ai/azure-openai';
import { WorkoutPlanController } from './workout-plan.controller';
import { WorkoutPlanService } from './workout-plan.service';

@Module({
  controllers: [WorkoutPlanController],
  providers: [...azureOpenAIProviders, WorkoutPlanService],
})
export class WorkoutPlanModule {}
