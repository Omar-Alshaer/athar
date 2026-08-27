import { Module } from '@nestjs/common';
import { PrivateStorageService } from './private-storage.service';

@Module({
  providers: [PrivateStorageService],
  exports: [PrivateStorageService],
})
export class PrivateStorageModule {}
