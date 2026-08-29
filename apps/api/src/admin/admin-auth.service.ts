import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserStatus } from '../generated/prisma/client';
import { PasswordService } from '../auth/password.service';
import { SessionService } from '../auth/session.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from '../auth/dto/login.dto';

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
  ) {}

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    const validPassword = await this.passwords.verify(dto.password, user?.passwordHash);

    if (
      !user ||
      !validPassword ||
      user.status !== UserStatus.ACTIVE ||
      (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')
    ) {
      throw new UnauthorizedException('بيانات دخول الإدارة غير صحيحة.');
    }

    const sessionToken = await this.sessions.create(user.id);

    await this.prisma.adminAuditLog.create({
      data: {
        actorUserId: user.id,
        action: 'ADMIN_LOGIN',
        entityType: 'User',
        entityId: user.id,
      },
    });

    return {
      user: this.sessions.publicUser(user),
      sessionToken,
    };
  }
}
