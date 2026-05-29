import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { AiModule } from './ai/ai.module';
import { HealthController } from './health.controller';

@Module({
  imports: [AuthModule, AiModule],
  controllers: [HealthController],
})
export class AppModule {}
