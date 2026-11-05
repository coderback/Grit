import { Module } from '@nestjs/common';
import { azureOpenAIProviders } from '../ai/azure-openai';
import { FoodModule } from '../food/food.module';
import { MealParseController } from './meal-parse.controller';
import { MealParseService } from './meal-parse.service';

@Module({
  imports: [FoodModule],
  controllers: [MealParseController],
  providers: [...azureOpenAIProviders, MealParseService],
})
export class MealParseModule {}
