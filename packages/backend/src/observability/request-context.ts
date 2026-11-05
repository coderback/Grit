import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import type { AuthUser } from '../common/current-user.decorator';

export type TracedRequest = Request & { requestId?: string; user?: AuthUser };

const logger = new Logger('HTTP');
const SAFE_ID = /^[A-Za-z0-9._-]{8,64}$/;

/**
 * Gives every request an ID (the caller's `x-request-id` if sensible, else a
 * new one), returns it in the response header, and logs one line per request
 * with its outcome and duration. Error responses carry the same ID, so a
 * user's report can be matched to the log line.
 */
export function requestContext(
  req: TracedRequest,
  res: Response,
  next: NextFunction,
) {
  const incoming = req.header('x-request-id');
  const id = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID();
  req.requestId = id;
  res.setHeader('x-request-id', id);

  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const path = req.originalUrl.split('?')[0];
    if (path === '/health' && res.statusCode < 400) return; // probes, every few seconds
    const entry = {
      requestId: id,
      method: req.method,
      path,
      status: res.statusCode,
      ms: Math.round(Number(process.hrtime.bigint() - started) / 1e6),
      user: req.user?.supabaseId,
    };
    if (res.statusCode >= 500) logger.error(entry);
    else if (res.statusCode >= 400) logger.warn(entry);
    else logger.log(entry);
  });
  next();
}
