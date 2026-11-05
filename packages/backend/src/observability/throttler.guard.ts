import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { createHash } from 'crypto';
import type { Request } from 'express';

/**
 * Counts requests per caller: per signed-in session where there is one, so
 * people sharing a mobile carrier's IP don't use up each other's allowance,
 * and per IP otherwise. A made-up token only gets its own bucket, never
 * someone else's.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const request = req as unknown as Request;
    const auth = request.headers?.authorization;
    const ip = request.ip ?? 'unknown';
    if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
      const session = createHash('sha256')
        .update(auth.slice(7))
        .digest('hex')
        .slice(0, 24);
      return Promise.resolve(`${ip}:${session}`);
    }
    return Promise.resolve(ip);
  }
}
