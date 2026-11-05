import { Module } from '@nestjs/common';
import { azureOpenAIProviders } from '../ai/azure-openai';
import { WorkoutPlanController } from './workout-plan.controller';
import { WorkoutPlanService } from './workout-plan.service';
import { ExercisesModule } from '../exercises/exercises.module';

@Module({
  imports: [ExercisesModule],
  controllers: [WorkoutPlanController],
  providers: [...azureOpenAIProviders, WorkoutPlanService],
})
export class WorkoutPlanModule {}
