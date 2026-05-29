import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { getDB } from '../database/db';

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  password_hash: string;
}

export interface LoginResult {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    username: string | null;
  };
}

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async login(identifier: string, password: string): Promise<LoginResult> {
    const sql = getDB();

    const rows = (await sql`
      SELECT id, email, name, username, password_hash
      FROM users
      WHERE email = ${identifier}
      OR username = ${identifier}
      LIMIT 1
    `) as UserRow[];

    const user = rows[0];
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = this.jwtService.sign(
      { sub: user.id, email: user.email },
      { expiresIn: '30d' },
    );

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
      },
    };
  }
}
