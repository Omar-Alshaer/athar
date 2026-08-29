import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SessionGuard } from './session.guard';
import { AuthenticatedUser, SessionService } from './session.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly rateLimit: AuthRateLimitService,
  ) {}

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const rateKey = `register:${this.clientKey(request)}`;
    this.rateLimit.assertAllowed(rateKey);

    const result = await this.auth.register(dto);
    this.setSessionCookie(response, result.sessionToken);
    this.rateLimit.clear(rateKey);

    return { user: result.user };
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const clientKey = this.clientKey(request);
    const rateKey = `login:${clientKey}:${dto.email.trim().toLowerCase()}`;
    const ipRateKey = `login-ip:${clientKey}`;
    this.rateLimit.assertAllowed(ipRateKey);
    this.rateLimit.assertAllowed(rateKey);

    const result = await this.auth.login(dto);
    this.setSessionCookie(response, result.sessionToken);
    this.rateLimit.clear(rateKey);
    this.rateLimit.clear(ipRateKey);

    return { user: result.user };
  }

  @UseGuards(SessionGuard)
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return { user };
  }

  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token = request.cookies?.[this.sessions.cookieName()] as string | undefined;
    await this.sessions.revoke(token);
    this.clearSessionCookie(response);
    return { ok: true };
  }

  @UseGuards(SessionGuard)
  @Post('logout-all')
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.sessions.revokeAll(user.id);
    this.clearSessionCookie(response);
    return { ok: true };
  }

  private setSessionCookie(response: Response, token: string): void {
    response.cookie(this.sessions.cookieName(), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: this.sessions.maxAgeMs(),
      ...(process.env.NODE_ENV === 'production' && process.env.COOKIE_DOMAIN
        ? { domain: process.env.COOKIE_DOMAIN }
        : {}),
    });
  }

  private clearSessionCookie(response: Response): void {
    response.clearCookie(this.sessions.cookieName(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      ...(process.env.NODE_ENV === 'production' && process.env.COOKIE_DOMAIN
        ? { domain: process.env.COOKIE_DOMAIN }
        : {}),
    });
  }

  private clientKey(request: Request): string {
    return request.ip || request.socket.remoteAddress || 'unknown';
  }
}
