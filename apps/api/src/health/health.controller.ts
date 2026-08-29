import { Controller, Get } from '@nestjs/common';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { PrismaService } from '../prisma/prisma.service';
import { PrivateStorageService } from '../storage/private-storage.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
    private readonly privateStorage: PrivateStorageService,
  ) {}

  @Get('live')
  live() {
    return {
      status: 'ok',
      service: 'athr-api',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  async ready() {
    await this.prisma.$queryRawUnsafe('SELECT 1');
    await this.privateStorage.assertWritable();

    return {
      status: 'ready',
      database: 'ok',
      cloudinary: this.cloudinary.isConfigured() ? 'configured' : 'not-configured',
      privateStorage: 'writable',
      timestamp: new Date().toISOString(),
    };
  }
}
