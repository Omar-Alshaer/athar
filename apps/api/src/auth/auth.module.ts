import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { SessionGuard } from './session.guard';
import { SessionService } from './session.service';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    SessionService,
    SessionGuard,
    AuthRateLimitService,
  ],
  exports: [SessionService, SessionGuard, PasswordService],
})
export class AuthModule {}
