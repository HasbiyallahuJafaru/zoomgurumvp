import { Controller, Post, Body, Headers } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(
    @Body() body: { email: string; password: string },
    @Headers('x-device-id') deviceId: string,
  ) {
    console.log('Device:', deviceId);
    return this.authService.login(body.email, body.password);
  }
}
