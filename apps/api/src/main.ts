import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    cors: false,
    // Required for verifying XPay webhook signatures against the exact request bytes.
    rawBody: true,
  });
  const express = app.getHttpAdapter().getInstance();

  express.set('trust proxy', 1);

  const localDevelopmentOrigins =
    process.env.NODE_ENV === 'production'
      ? []
      : [
          'http://127.0.0.1:8090',
          'http://localhost:8090',
          'http://127.0.0.1:3100',
          'http://localhost:3100',
        ];

  const allowedOrigins = [
    process.env.WEB_ORIGIN,
    process.env.ADMIN_ORIGIN,
    ...localDevelopmentOrigins,
  ].filter((origin): origin is string => Boolean(origin));

  app.enableCors({
    credentials: true,
    origin(
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin is not allowed by ATHR CORS policy.'), false);
    },
  });

  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
