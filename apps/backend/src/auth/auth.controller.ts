import { Controller, Post, Body, Headers } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(
    @Body() body: { email: string; name: string; password: string },
    @Headers('x-device-id') deviceId: string,
  ) {
    console.log('Register device:', deviceId);
    return this.authService.register(body.email, body.name, body.password);
  }

  @Post('login')
  async login(
    @Body() body: { email: string; password: string },
    @Headers('x-device-id') deviceId: string,
  ) {
    console.log('Device:', deviceId);
    return this.authService.login(body.email, body.password);
  }
}
