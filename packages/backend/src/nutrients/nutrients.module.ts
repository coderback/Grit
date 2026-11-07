import { Module } from '@nestjs/common';
import { NutrientsController } from './nutrients.controller';
import { NutrientsService } from './nutrients.service';

@Module({
  controllers: [NutrientsController],
  providers: [NutrientsService],
})
export class NutrientsModule {}
