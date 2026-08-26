import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { appConfig } from './config/app.config';
import { AuthModule } from './auth/auth.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { CatalogModule } from './catalog/catalog.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { NewsletterModule } from './newsletter/newsletter.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
      load: [appConfig],
    }),
    PrismaModule,
    AuthModule,
    CloudinaryModule,
    CatalogModule,
    WishlistModule,
    NewsletterModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
