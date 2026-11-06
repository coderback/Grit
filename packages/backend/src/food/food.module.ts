import { Module } from '@nestjs/common';
import { FoodService } from './food.service';
import { FoodDbService } from './food-db.service';
import { FoodController } from './food.controller';
import { QuickFoodsController } from './quick-foods.controller';
import { QuickFoodsService } from './quick-foods.service';

@Module({
  providers: [FoodService, FoodDbService, QuickFoodsService],
  controllers: [QuickFoodsController, FoodController],
  exports: [FoodService, FoodDbService],
})
export class FoodModule {}
