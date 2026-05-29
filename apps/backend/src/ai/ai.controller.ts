import { Controller, Post, Body, Res, Req, UseGuards, HttpCode, HttpException, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FastifyReply, FastifyRequest } from 'fastify';
import { AiService } from './ai.service';

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'Access-Control-Allow-Origin': '*',
} as const;

const RATE_LIMIT = 3;
const WINDOW_MS = 60_000;

interface RateWindow {
  count: number;
  windowStart: number;
}

interface AuthenticatedRequest extends FastifyRequest {
  user: { userId: string; email: string };
}

const rateLimits = new Map<string, RateWindow>();

function checkRateLimit(userId: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const window = rateLimits.get(userId);

  if (!window || now - window.windowStart > WINDOW_MS) {
    rateLimits.set(userId, { count: 1, windowStart: now });
    return { allowed: true, retryAfter: 0 };
  }

  if (window.count >= RATE_LIMIT) {
    const retryAfter = Math.ceil((WINDOW_MS - (now - window.windowStart)) / 1000);
    return { allowed: false, retryAfter };
  }

  window.count++;
  return { allowed: true, retryAfter: 0 };
}

@Controller('ai')
export class AiController {
  constructor(private aiService: AiService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post('stream')
  async stream(
    @Req() req: AuthenticatedRequest,
    @Body() body: { transcript: string; sessionId?: string; cvText?: string; jdText?: string },
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const { allowed, retryAfter } = checkRateLimit(req.user.userId);
    if (!allowed) {
      await reply.code(429).send({ error: 'rate_limit', retryAfter });
      return;
    }
    reply.raw.writeHead(200, SSE_HEADERS);
    await this.aiService.streamAnswer({
      transcript: body.transcript,
      reply: reply.raw,
      cvText: body.cvText,
      jdText: body.jdText,
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('screenshot')
  async screenshot(
    @Req() req: AuthenticatedRequest,
    @Body() body: { image: string; sessionId?: string; cvText?: string; jdText?: string },
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const { allowed, retryAfter } = checkRateLimit(req.user.userId);
    if (!allowed) {
      await reply.code(429).send({ error: 'rate_limit', retryAfter });
      return;
    }
    reply.raw.writeHead(200, SSE_HEADERS);
    await this.aiService.streamScreenshot({
      image: body.image,
      reply: reply.raw,
      cvText: body.cvText,
      jdText: body.jdText,
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @HttpCode(200)
  @Post('transcribe')
  async transcribe(
    @Body() body: { audio: string },
  ): Promise<{ transcript: string }> {
    const transcript = await this.aiService.transcribe({ audio: body.audio });
    return { transcript };
  }
}
