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
    const pool = getDB();
    const passwordHash = await bcrypt.hash(password, 10);

    let user: UserRow;
    try {
      const result = await pool.query<UserRow>(
        `INSERT INTO users (email, name, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, email, name, username, password_hash`,
        [email, name, passwordHash],
      );
      user = result.rows[0];
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('unique')) {
        throw new ConflictException('Email already in use');
      }
      throw err;
    }

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
    const pool = getDB();

    const result = await pool.query<UserRow>(
      `(SELECT id, email, name, username, password_hash
          FROM users WHERE email = $1 LIMIT 1)
       UNION ALL
       (SELECT id, email, name, username, password_hash
          FROM users WHERE username = $1 LIMIT 1)
       LIMIT 1`,
      [identifier],
    );

    const user = result.rows[0];
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
