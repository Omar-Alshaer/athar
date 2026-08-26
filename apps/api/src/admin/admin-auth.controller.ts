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
import { LoginDto } from '../auth/dto/login.dto';
import { AuthenticatedUser, SessionService } from '../auth/session.service';
import { AdminAuthService } from './admin-auth.service';
import { AdminGuard } from './admin.guard';
import { AdminRateLimitService } from './admin-rate-limit.service';
import { CurrentAdmin } from './current-admin.decorator';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly sessions: SessionService,
    private readonly rateLimit: AdminRateLimitService,
  ) {}

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const rateKey = `admin-login:${this.clientKey(request)}:${dto.email
      .trim()
      .toLowerCase()}`;
    this.rateLimit.assertAllowed(rateKey);

    const result = await this.auth.login(dto);
    this.setAdminCookie(response, result.sessionToken);
    this.rateLimit.clear(rateKey);

    return { user: result.user };
  }

  @UseGuards(AdminGuard)
  @Get('me')
  me(@CurrentAdmin() user: AuthenticatedUser) {
    return { user };
  }

  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cookieName = this.cookieName();
    const token = request.cookies?.[cookieName] as string | undefined;
    await this.sessions.revoke(token);
    this.clearAdminCookie(response);
    return { ok: true };
  }

  private cookieName(): string {
    return process.env.ADMIN_SESSION_COOKIE_NAME || 'athr_admin_session';
  }

  private setAdminCookie(response: Response, token: string): void {
    response.cookie(this.cookieName(), token, {
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

  private clearAdminCookie(response: Response): void {
    response.clearCookie(this.cookieName(), {
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
