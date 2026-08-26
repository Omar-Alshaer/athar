import { Controller, Get } from '@nestjs/common';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
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

    return {
      status: 'ready',
      database: 'ok',
      cloudinary: this.cloudinary.isConfigured() ? 'configured' : 'not-configured',
      timestamp: new Date().toISOString(),
    };
  }
}
