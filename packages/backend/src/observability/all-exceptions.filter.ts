import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import type { TracedRequest } from './request-context';

/**
 * The last stop for errors. HTTP errors keep their usual body (the app reads
 * `message`); a missing or duplicate record becomes a 404 or 409 instead of a
 * 500; anything else is logged with its stack and answered with a generic
 * message, so internals never reach the client. Every error body carries the
 * request ID.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<TracedRequest>();
    const requestId = req.requestId;

    const { status, body } = this.describe(exception);
    if (status >= 500) {
      this.logger.error({
        requestId,
        method: req.method,
        path: req.originalUrl?.split('?')[0],
        error:
          exception instanceof Error ? exception.message : String(exception),
        stack: exception instanceof Error ? exception.stack : undefined,
      });
    }

    // A streamed reply (the coach) may already have started
    if (res.headersSent) {
      res.end();
      return;
    }
    res.status(status).json({ ...body, requestId });
  }

  private describe(exception: unknown): {
    status: number;
    body: Record<string, unknown>;
  } {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const body =
        typeof response === 'string'
          ? { statusCode: exception.getStatus(), message: response }
          : (response as Record<string, unknown>);
      return { status: exception.getStatus(), body };
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2025') {
        return {
          status: 404,
          body: { statusCode: 404, message: 'Not found', error: 'Not Found' },
        };
      }
      if (exception.code === 'P2002') {
        return {
          status: 409,
          body: {
            statusCode: 409,
            message: 'Already exists',
            error: 'Conflict',
          },
        };
      }
    }
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        statusCode: 500,
        message: 'Something went wrong. Please try again.',
        error: 'Internal Server Error',
      },
    };
  }
}
