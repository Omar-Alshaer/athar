import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticatedUser, SessionService } from '../auth/session.service';

export type AdminAuthenticatedRequest = Request & { athrAdmin?: AuthenticatedUser };

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AdminAuthenticatedRequest>();
    const cookieName = process.env.ADMIN_SESSION_COOKIE_NAME || 'athr_admin_session';
    const token = request.cookies?.[cookieName] as string | undefined;
    const user = await this.sessions.resolve(token);

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('غير مصرح لك بالدخول إلى لوحة الإدارة.');
    }

    request.athrAdmin = user;
    return true;
  }
}
