import { Controller, Post, Body, Headers, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';

function sanitize(s: string): string {
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

function sanitizeLine(s: string): string {
  return s.replace(/[\x00-\x1F\x7F]/g, '');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DEVICE_ID_RE = /^[a-f0-9]{64}$/;

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(
    @Body() body: { email: string; name: string; password: string },
  ) {
    if (!body.email || body.email.length > 254) {
      throw new BadRequestException('Invalid email');
    }
    if (!body.name || body.name.length > 100) {
      throw new BadRequestException('Invalid name');
    }
    if (!body.password || body.password.length < 8 || body.password.length > 128) {
      throw new BadRequestException('Invalid password');
    }

    const cleanEmail    = sanitizeLine(body.email);
    const cleanName     = sanitizeLine(body.name);
    const cleanPassword = sanitize(body.password);

    if (!EMAIL_RE.test(cleanEmail)) {
      throw new BadRequestException('Invalid email format');
    }

    return this.authService.register(cleanEmail, cleanName, cleanPassword);
  }

  @Post('login')
  async login(
    @Body() body: { email: string; password: string },
    @Headers('x-device-id') deviceId: string | undefined,
  ) {
    if (!body.email || body.email.length > 254) {
      throw new BadRequestException('Invalid email');
    }
    if (!body.password || body.password.length > 128) {
      throw new BadRequestException('Invalid password');
    }

    const cleanIdentifier = sanitizeLine(body.email);
    const cleanPassword   = sanitize(body.password);

    if (!EMAIL_RE.test(cleanIdentifier) && cleanIdentifier.length < 3) {
      throw new BadRequestException('Invalid identifier');
    }
    if (deviceId && !DEVICE_ID_RE.test(deviceId)) {
      throw new BadRequestException('Invalid device ID');
    }

    return this.authService.login(cleanIdentifier, cleanPassword);
  }
}
