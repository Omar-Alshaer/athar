import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrivateStorageModule } from '../storage/private-storage.module';
import { CommerceController } from './commerce.controller';
import { CommerceService } from './commerce.service';

@Module({
  imports: [AuthModule, PrivateStorageModule],
  controllers: [CommerceController],
  providers: [CommerceService],
})
export class CommerceModule {}
