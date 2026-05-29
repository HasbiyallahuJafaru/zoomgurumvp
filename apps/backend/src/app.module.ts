import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [AuthModule, AiModule],
})
export class AppModule {}
