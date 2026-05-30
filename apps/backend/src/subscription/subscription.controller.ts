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

  @Post('checkout')
  @UseGuards(AuthGuard('jwt'))
  async checkout(
    @Req() req: AuthRequest,
    @Body() body: { plan: string },
  ) {
    if (body.plan !== 'monthly' && body.plan !== 'annual') {
      throw new BadRequestException('plan must be monthly or annual');
    }
    return this.subscriptionService.checkout(
      req.user.userId,
      req.user.email,
      body.plan,
    );
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
