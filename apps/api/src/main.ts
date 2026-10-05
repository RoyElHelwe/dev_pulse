import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // nginx is in front: trust its X-Forwarded-* headers (real client IP, https).
  app.set('trust proxy', 1);
  app.use(cookieParser());

  // Every HTTP route lives under /api (nginx forwards /api/* here).
  app.setGlobalPrefix('api');

  // Validate every request body / query against its DTO class.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  Logger.log(`API listening on port ${port}`, 'Bootstrap');
}

void bootstrap();
