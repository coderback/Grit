import { Module } from '@nestjs/common';
import { FoodService } from './food.service';
import { FoodController } from './food.controller';
import { QuickFoodsController } from './quick-foods.controller';
import { QuickFoodsService } from './quick-foods.service';

@Module({
  providers: [FoodService, QuickFoodsService],
  controllers: [QuickFoodsController, FoodController],
  exports: [FoodService],
})
export class FoodModule {}
