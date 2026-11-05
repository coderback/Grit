import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../common/current-user.decorator';
import { TokenVerifier } from './token-verifier';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private verifier: TokenVerifier) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers['authorization'];

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing authorization header');
    }

    const user = await this.verifier.verify(authHeader.slice(7));
    if (!user) throw new UnauthorizedException('Invalid or expired token');

    request.user = user;
    return true;
  }
}
