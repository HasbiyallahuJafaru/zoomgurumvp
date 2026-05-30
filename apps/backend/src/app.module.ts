import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { AiModule } from './ai/ai.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { HealthController } from './health.controller';

@Module({
  imports: [AuthModule, AiModule, SubscriptionModule],
  controllers: [HealthController],
})
export class AppModule {}
