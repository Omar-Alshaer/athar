import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticatedUser, SessionService } from './session.service';

export type AuthenticatedRequest = Request & { athrUser?: AuthenticatedUser };

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.cookies?.[this.sessions.cookieName()] as string | undefined;
    request.athrUser = await this.sessions.resolve(token);
    return true;
  }
}
