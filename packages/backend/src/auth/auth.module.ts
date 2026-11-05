import { Global, Module } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { AuthController } from './auth.controller';
import { TokenVerifier } from './token-verifier';
import { UsersModule } from '../users/users.module';

// Global, because every feature module uses @UseGuards(AuthGuard)
@Global()
@Module({
  imports: [UsersModule],
  providers: [AuthGuard, TokenVerifier],
  controllers: [AuthController],
  exports: [AuthGuard, TokenVerifier],
})
export class AuthModule {}
