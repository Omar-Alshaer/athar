import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { UserStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
  ) {}

  async register(dto: RegisterDto) {
    const email = this.normalizeEmail(dto.email);
    const existing = await this.prisma.user.findUnique({ where: { email } });

    if (existing) {
      throw new ConflictException('يوجد حساب مسجل بهذا البريد الإلكتروني بالفعل.');
    }

    const passwordHash = await this.passwords.hash(dto.password);

    try {
      const user = await this.prisma.user.create({
        data: {
          fullName: dto.fullName.trim(),
          email,
          phone: dto.phone?.trim() || null,
          passwordHash,
        },
      });

      const sessionToken = await this.sessions.create(user.id);
      return { user: this.sessions.publicUser(user), sessionToken };
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') {
        throw new ConflictException('يوجد حساب مسجل بهذا البريد الإلكتروني بالفعل.');
      }
      throw error;
    }
  }

  async login(dto: LoginDto) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !(await this.passwords.verify(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('هذا الحساب غير متاح حاليًا.');
    }

    const sessionToken = await this.sessions.create(user.id);
    return { user: this.sessions.publicUser(user), sessionToken };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
