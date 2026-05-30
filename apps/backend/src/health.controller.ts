import { Controller, Get, Req, ForbiddenException } from '@nestjs/common';
import { FastifyRequest } from 'fastify';

@Controller('health')
export class HealthController {
  @Get()
  check(@Req() req: FastifyRequest): { status: string } {
    if (req.ip !== '127.0.0.1' && req.ip !== '::1') {
      throw new ForbiddenException();
    }
    return { status: 'ok' };
  }
}
