import {
  Controller, Post, Get, Body, Res, UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { AIService } from './ai.service';
import { SendMessageDto } from './ai.dto';
import { UtcOffset } from '../common/utc-offset.decorator';

@Controller('ai')
@UseGuards(AuthGuard)
export class AIController {
  constructor(private ai: AIService) {}

  @Post('message')
  async streamMessage(
    @CurrentUser() user: { supabaseId: string },
    @Body() body: SendMessageDto,
    @UtcOffset() offset: number,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      for await (const chunk of this.ai.streamMessage(user.supabaseId, body.message, offset)) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
    } catch (err: any) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: err.message ?? 'Unknown error' })}\n\n`);
    }

    res.end();
  }

  @Get('messages')
  getMessages(@CurrentUser() user: { supabaseId: string }) {
    return this.ai.getMessages(user.supabaseId);
  }

  @Get('nudge')
  async getNudge(
    @CurrentUser() user: { supabaseId: string },
    @UtcOffset() offset: number,
  ) {
    const nudge = await this.ai.getNudge(user.supabaseId, offset);
    return { nudge };
  }
}
