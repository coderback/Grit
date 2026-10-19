import { Controller, Get, Put, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateUserDto } from './users.dto';

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
    @Body() body: UpdateUserDto,
  ) {
    return this.users.updateUser(user.supabaseId, body);
  }

  @Get(':id')
  async getUser(@Param('id') id: string) {
    return this.users.findPublicById(id);
  }
}
