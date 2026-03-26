import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface SupabaseJwtPayload {
  sub: string;          // Supabase user UID
  email?: string;
  role: string;
  aud: string;
  exp: number;
  user_metadata?: Record<string, unknown>;
}

@Injectable()
export class SupabaseStrategy extends PassportStrategy(Strategy, 'supabase') {
  constructor(private config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Supabase signs JWTs with the JWT secret from project settings
      secretOrKey: Buffer.from(config.getOrThrow<string>('SUPABASE_JWT_SECRET'), 'base64'),
    });
  }

  async validate(payload: SupabaseJwtPayload) {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }
    // Return the payload — it will be attached as request.user
    return { supabaseId: payload.sub, email: payload.email };
  }
}
