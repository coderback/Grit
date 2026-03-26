import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private users: UsersService) {}

  @Get('me')
  async getMe(@CurrentUser() user: { supabaseId: string }) {
    return this.users.findBySupabaseId(user.supabaseId);
  }

  @Put('me')
  async updateMe(
    @CurrentUser() user: { supabaseId: string },
    @Body()
    body: {
      displayName?: string;
      avatarUrl?: string;
      calorieGoal?: number;
      weightKg?: number;
      primaryGoal?: string;
    },
  ) {
    return this.users.updateUser(user.supabaseId, body);
  }

  @Get(':id')
  async getUser(@Param('id') id: string) {
    return this.users.findById(id);
  }
}
