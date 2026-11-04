import {
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  Post,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PrismaService } from './prisma/prisma.service';
import type { TracedRequest } from './observability/request-context';

class ClientErrorDto {
  @IsString()
  @MaxLength(500)
  message: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  stack?: string;

  // The screen (route) it happened on
  @IsOptional()
  @IsString()
  @MaxLength(200)
  screen?: string;

  @IsIn(['ios', 'android', 'web'])
  platform: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  appVersion?: string;
}

@Controller()
export class AppController {
  private readonly crashLog = new Logger('ClientCrash');
  private readonly started = Date.now();

  constructor(private prisma: PrismaService) {}

  @Get()
  @SkipThrottle()
  root() {
    return { name: 'grit-api' };
  }

  /** For the platform's health checks: up, and able to reach the database. */
  @Get('health')
  @SkipThrottle()
  async health() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'unreachable',
      });
    }
    return {
      status: 'ok',
      database: 'ok',
      uptimeSeconds: Math.round((Date.now() - this.started) / 1000),
    };
  }

  /**
   * Crashes caught by the app's error boundary, written to the logs. No
   * sign-in needed: a crash can happen before it. Throttled hard.
   */
  @Post('client-errors')
  @HttpCode(204)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  reportClientError(@Body() body: ClientErrorDto, @Req() req: TracedRequest) {
    this.crashLog.error({
      requestId: req.requestId,
      platform: body.platform,
      appVersion: body.appVersion,
      screen: body.screen,
      message: body.message,
      stack: body.stack,
    });
  }
}
