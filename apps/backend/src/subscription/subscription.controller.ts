import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  Headers,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FastifyRequest } from 'fastify';
import { SubscriptionService } from './subscription.service';

interface AuthRequest {
  user: { userId: string; email: string };
}

interface WebhookRequest extends FastifyRequest {
  rawBody?: Buffer;
}

@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get('status')
  @UseGuards(AuthGuard('jwt'))
  async getStatus(@Req() req: AuthRequest) {
    return this.subscriptionService.getStatus(req.user.userId);
  }

  @Post('verify')
  @UseGuards(AuthGuard('jwt'))
  async verify(
    @Req() req: AuthRequest,
    @Body() body: { reference: string },
  ) {
    if (!body.reference || typeof body.reference !== 'string') {
      throw new BadRequestException('reference is required');
    }
    return this.subscriptionService.verify(req.user.userId, body.reference);
  }

  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Req() req: WebhookRequest,
    @Headers('x-paystack-signature') signature: string | undefined,
  ) {
    if (!req.rawBody) {
      throw new BadRequestException('Missing raw body');
    }
    await this.subscriptionService.handleWebhook(req.rawBody, signature ?? '');
    return { received: true };
  }
}
