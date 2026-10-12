/**
 * Application entry point for the DevPulse API server.
 * Bootstraps NestJS, configures global reverse-proxy headers, cookies, validation pipes, and starts listening.
 */
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

const DEFAULT_PORT = 4000;
const TRUSTED_PROXY_HOPS = 1;

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Trust first proxy hop (nginx) so req.ip and req.protocol accurately reflect the real client.
  app.set('trust proxy', TRUSTED_PROXY_HOPS);
  app.use(cookieParser());

  // Every HTTP route lives under /api (nginx forwards /api/* here).
  app.setGlobalPrefix('api');

  // Validate every request body / query against its DTO class.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  await app.listen(port, '0.0.0.0');
  Logger.log(`API listening on port ${port}`, 'Bootstrap');
}

void bootstrap();

