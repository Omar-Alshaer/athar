import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';
import { AdminRateLimitService } from './admin-rate-limit.service';
import { AdminService } from './admin.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminAuthController, AdminController],
  providers: [
    AdminAuthService,
    AdminGuard,
    AdminRateLimitService,
    AdminService,
  ],
})
export class AdminModule {}
