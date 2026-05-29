import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
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

  async register(email: string, name: string, password: string): Promise<LoginResult> {
    const sql = getDB();
    const passwordHash = await bcrypt.hash(password, 12);

    let rows: UserRow[];
    try {
      rows = (await sql`
        INSERT INTO users (email, name, password_hash)
        VALUES (${email}, ${name}, ${passwordHash})
        RETURNING id, email, name, username, password_hash
      `) as UserRow[];
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('unique')) {
        throw new ConflictException('Email already in use');
      }
      throw err;
    }

    const user = rows[0];
    const accessToken = this.jwtService.sign(
      { sub: user.id, email: user.email },
      { expiresIn: '30d' },
    );

    return {
      accessToken,
      user: { id: user.id, email: user.email, name: user.name, username: user.username },
    };
  }

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
