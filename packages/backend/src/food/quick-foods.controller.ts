import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { SaveFavoriteDto } from './food.dto';
import { QuickFoodsService } from './quick-foods.service';

type Me = { supabaseId: string };

/** Recently eaten and favourite foods, for logging again in one tap. */
@Controller('food')
@UseGuards(AuthGuard)
export class QuickFoodsController {
  constructor(private quick: QuickFoodsService) {}

  @Get('recent')
  recent(@CurrentUser() user: Me) {
    return this.quick.recent(user.supabaseId);
  }

  @Get('favorites')
  favorites(@CurrentUser() user: Me) {
    return this.quick.favorites(user.supabaseId);
  }

  @Post('favorites')
  save(@CurrentUser() user: Me, @Body() body: SaveFavoriteDto) {
    return this.quick.save(user.supabaseId, body);
  }

  @Delete('favorites/:id')
  remove(@CurrentUser() user: Me, @Param('id') id: string) {
    return this.quick.remove(user.supabaseId, id);
  }
}
