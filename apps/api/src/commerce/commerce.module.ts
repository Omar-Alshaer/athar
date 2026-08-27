import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrivateStorageModule } from '../storage/private-storage.module';
import { CommerceController } from './commerce.controller';
import { CommerceService } from './commerce.service';
import { XPayService } from './xpay.service';
import { XPayWebhookController } from './xpay-webhook.controller';

@Module({
  imports: [AuthModule, PrivateStorageModule],
  controllers: [CommerceController, XPayWebhookController],
  providers: [CommerceService, XPayService],
})
export class CommerceModule {}
