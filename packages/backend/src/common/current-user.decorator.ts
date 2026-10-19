import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** The signed-in Supabase user, set on the request by AuthGuard. */
export interface AuthUser {
  supabaseId: string;
  email?: string;
}

export type AuthenticatedRequest = Request & { user?: AuthUser };

/**
 * Extracts the authenticated user from the request.
 * Usage: @CurrentUser() user: { supabaseId: string; email?: string }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user;
  },
);
