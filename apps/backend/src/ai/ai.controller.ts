import { Controller, Post, Body, Res, Req, UseGuards, HttpCode, HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FastifyReply, FastifyRequest } from 'fastify';
import { AiService } from './ai.service';

function sanitize(s: string): string {
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

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

setInterval(() => {
  const now = Date.now();
  for (const [userId, window] of rateLimits.entries()) {
    if (now - window.windowStart > WINDOW_MS) {
      rateLimits.delete(userId);
    }
  }
}, 5 * 60_000);

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
    if (!body.transcript || body.transcript.length > 4000) {
      throw new BadRequestException('Invalid transcript');
    }
    const { allowed, retryAfter } = checkRateLimit(req.user.userId);
    if (!allowed) {
      await reply.code(429).send({ error: 'rate_limit', retryAfter });
      return;
    }
    const cleanTranscript = sanitize(body.transcript);
    const cleanCv         = body.cvText ? sanitize(body.cvText) : undefined;
    const cleanJd         = body.jdText ? sanitize(body.jdText) : undefined;
    reply.raw.writeHead(200, SSE_HEADERS);
    await this.aiService.streamAnswer({
      transcript: cleanTranscript,
      reply: reply.raw,
      cvText: cleanCv,
      jdText: cleanJd,
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('screenshot')
  async screenshot(
    @Req() req: AuthenticatedRequest,
    @Body() body: { image: string; sessionId?: string; cvText?: string; jdText?: string },
    @Res() reply: FastifyReply,
  ): Promise<void> {
    if (!body.image || body.image.length > 10_000_000) {
      throw new BadRequestException('Invalid image');
    }
    const { allowed, retryAfter } = checkRateLimit(req.user.userId);
    if (!allowed) {
      await reply.code(429).send({ error: 'rate_limit', retryAfter });
      return;
    }
    const cleanImage = sanitize(body.image);
    const cleanCv    = body.cvText ? sanitize(body.cvText) : undefined;
    const cleanJd    = body.jdText ? sanitize(body.jdText) : undefined;
    reply.raw.writeHead(200, SSE_HEADERS);
    await this.aiService.streamScreenshot({
      image: cleanImage,
      reply: reply.raw,
      cvText: cleanCv,
      jdText: cleanJd,
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @HttpCode(200)
  @Post('transcribe')
  async transcribe(
    @Req() req: AuthenticatedRequest,
    @Body() body: { audio: string },
  ): Promise<{ transcript: string }> {
    if (!body.audio || body.audio.length > 5_000_000) {
      throw new BadRequestException('Invalid audio');
    }
    const { allowed, retryAfter } = checkRateLimit(req.user.userId);
    if (!allowed) {
      throw new HttpException({ error: 'rate_limit', retryAfter }, 429);
    }
    const cleanAudio = sanitize(body.audio);
    const transcript = await this.aiService.transcribe({ audio: cleanAudio });
    return { transcript };
  }
}
