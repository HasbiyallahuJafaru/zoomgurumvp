import { Controller, Post, Body, Res, UseGuards, HttpCode } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FastifyReply } from 'fastify';
import { AiService } from './ai.service';

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'Access-Control-Allow-Origin': '*',
} as const;

@Controller('ai')
export class AiController {
  constructor(private aiService: AiService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post('stream')
  async stream(
    @Body() body: { transcript: string; sessionId?: string },
    @Res() reply: FastifyReply,
  ): Promise<void> {
    reply.raw.writeHead(200, SSE_HEADERS);
    await this.aiService.streamAnswer({
      transcript: body.transcript,
      reply: reply.raw,
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('screenshot')
  async screenshot(
    @Body() body: { image: string; sessionId?: string },
    @Res() reply: FastifyReply,
  ): Promise<void> {
    reply.raw.writeHead(200, SSE_HEADERS);
    await this.aiService.streamScreenshot({
      image: body.image,
      reply: reply.raw,
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
