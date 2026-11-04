import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  createRemoteJWKSet,
  decodeProtectedHeader,
  jwtVerify,
  type JWTVerifyGetKey,
} from 'jose';
import type { AuthUser } from '../common/current-user.decorator';

/**
 * Checks Supabase access tokens. Tokens signed with the project's asymmetric
 * key (ES256/RS256) are verified here against its published keys, cached, so
 * a request doesn't wait on a call to Supabase. Anything else (older HS256
 * projects) is checked by asking Supabase, as before.
 *
 * Trade-off: a locally verified token stays valid until it expires (an hour)
 * even after sign-out. Deleted accounts still fail, because their user row is
 * gone.
 */
@Injectable()
export class TokenVerifier {
  private readonly logger = new Logger(TokenVerifier.name);
  private readonly issuer: string;
  // Replaceable in tests
  keys: JWTVerifyGetKey;
  supabase: Pick<SupabaseClient, 'auth'>;

  constructor(config: ConfigService) {
    const url = config.getOrThrow<string>('SUPABASE_URL').replace(/\/+$/, '');
    this.issuer = `${url}/auth/v1`;
    this.keys = createRemoteJWKSet(
      new URL(`${this.issuer}/.well-known/jwks.json`),
      {
        cacheMaxAge: 10 * 60_000,
        cooldownDuration: 30_000,
      },
    );
    this.supabase = createClient(
      url,
      config.getOrThrow<string>('SUPABASE_ANON_KEY'),
    );
  }

  /** The signed-in user, or null if the token isn't valid. */
  async verify(token: string): Promise<AuthUser | null> {
    let alg: string | undefined;
    try {
      alg = decodeProtectedHeader(token).alg;
    } catch {
      return null; // not a JWT at all
    }

    if (alg === 'ES256' || alg === 'RS256') {
      try {
        const { payload } = await jwtVerify(token, this.keys, {
          issuer: this.issuer,
          audience: 'authenticated',
          algorithms: [alg],
        });
        if (typeof payload.sub !== 'string' || payload.role !== 'authenticated')
          return null;
        return {
          supabaseId: payload.sub,
          email: typeof payload.email === 'string' ? payload.email : undefined,
        };
      } catch (err) {
        const code = (err as { code?: string }).code ?? '';
        // A bad or expired token is final; only a key lookup problem falls back
        if (!code.startsWith('ERR_JWKS') && code !== 'ERR_JOSE_GENERIC')
          return null;
        this.logger.warn(
          `Key lookup failed (${code}); asking Supabase instead`,
        );
      }
    }

    const { data, error } = await this.supabase.auth.getUser(token);
    if (error || !data.user) return null;
    return { supabaseId: data.user.id, email: data.user.email };
  }
}
