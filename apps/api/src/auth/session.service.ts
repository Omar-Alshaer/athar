import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomBytes } from 'node:crypto';
import { UserStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type AuthenticatedUser = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: 'CUSTOMER' | 'ADMIN' | 'SUPER_ADMIN';
  status: 'ACTIVE' | 'SUSPENDED';
  emailVerifiedAt: Date | null;
  createdAt: Date;
};

@Injectable()
export class SessionService {
  private readonly secret: string;
  private readonly ttlDays: number;

  constructor(private readonly prisma: PrismaService) {
    this.secret = process.env.SESSION_SECRET ?? '';
    this.ttlDays = Math.max(1, Math.min(90, Number(process.env.SESSION_TTL_DAYS ?? 30)));

    if (!this.secret || this.secret.length < 32) {
      throw new Error('SESSION_SECRET must be at least 32 characters.');
    }
  }

  cookieName(): string {
    return process.env.SESSION_COOKIE_NAME || 'athr_session';
  }

  maxAgeMs(): number {
    return this.ttlDays * 24 * 60 * 60 * 1000;
  }

  async create(userId: string): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + this.maxAgeMs());

    await this.prisma.$transaction([
      this.prisma.userSession.deleteMany({
        where: {
          userId,
          OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { not: null } }],
        },
      }),
      this.prisma.userSession.create({
        data: { userId, tokenHash, expiresAt },
      }),
    ]);

    return token;
  }

  async resolve(token: string | undefined): Promise<AuthenticatedUser> {
    if (!token) throw new UnauthorizedException('يجب تسجيل الدخول أولًا.');

    const session = await this.prisma.userSession.findUnique({
      where: { tokenHash: this.hashToken(token) },
      include: { user: true },
    });

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now() ||
      session.user.status !== UserStatus.ACTIVE
    ) {
      throw new UnauthorizedException('انتهت الجلسة أو لم تعد صالحة.');
    }

    return this.publicUser(session.user);
  }

  async revoke(token: string | undefined): Promise<void> {
    if (!token) return;
    await this.prisma.userSession.updateMany({
      where: { tokenHash: this.hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAll(userId: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  publicUser(user: {
    id: string;
    email: string;
    fullName: string;
    phone: string | null;
    role: 'CUSTOMER' | 'ADMIN' | 'SUPER_ADMIN';
    status: 'ACTIVE' | 'SUSPENDED';
    emailVerifiedAt: Date | null;
    createdAt: Date;
  }): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
    };
  }

  private hashToken(token: string): string {
    return createHmac('sha256', this.secret).update(token).digest('hex');
  }
}
