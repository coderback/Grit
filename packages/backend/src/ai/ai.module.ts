import { Module } from '@nestjs/common';
import { AIController } from './ai.controller';
import { AIService } from './ai.service';
import { azureOpenAIProviders } from './azure-openai';
import { ProgressModule } from '../progress/progress.module';
import { WorkoutsModule } from '../workouts/workouts.module';

@Module({
  imports: [ProgressModule, WorkoutsModule],
  controllers: [AIController],
  providers: [...azureOpenAIProviders, AIService],
})
export class AIModule {}
