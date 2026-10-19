import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

// Real-world offsets range from UTC-12:00 to UTC+14:00
const MAX_OFFSET_MIN = 14 * 60;

/**
 * The client's UTC offset in minutes (local minus UTC), from the
 * `x-utc-offset` header. Falls back to 0 (UTC) when missing or invalid.
 * Usage: @UtcOffset() offset: number
 */
export const UtcOffset = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const raw = request.headers['x-utc-offset'];
    const offset = Number(Array.isArray(raw) ? raw[0] : raw);
    return Number.isInteger(offset) && Math.abs(offset) <= MAX_OFFSET_MIN
      ? offset
      : 0;
  },
);
