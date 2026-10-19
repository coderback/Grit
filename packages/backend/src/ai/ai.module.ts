import { Module } from '@nestjs/common';
import { AIController } from './ai.controller';
import { AIService } from './ai.service';
import { azureOpenAIProviders } from './azure-openai';

@Module({
  controllers: [AIController],
  providers: [...azureOpenAIProviders, AIService],
})
export class AIModule {}
