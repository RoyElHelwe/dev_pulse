import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const httpsOptions =
    process.env.NODE_ENV !== 'production'
      ? {
          key: fs.readFileSync(path.join(__dirname, '../../../certs/key.pem')),
          cert: fs.readFileSync(path.join(__dirname, '../../../certs/cert.pem')),
        }
      : undefined;

  const app = await NestFactory.create(AppModule, {
    httpsOptions,
    cors: {
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);
        
        // Allow configured origins or any origin in development
        const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || [];
        if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(null, true); // Allow all in development
        }
      },
      credentials: true,
    },
  });

  // Security - Configure helmet to not interfere with cookies
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Cookie parser for handling cookies
  app.use(cookieParser());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger/OpenAPI documentation
  const config = new DocumentBuilder()
    .setTitle('ft_transcendence API')
    .setDescription(
      'Collaborative Workspace with 2D Metaverse - API Documentation',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication endpoints')
    .addTag('workspaces', 'Workspace management')
    .addTag('tasks', 'Task management')
    .addTag('chat', 'Real-time messaging')
    .addTag('game', '2D office and game state')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = Number(process.env.API_GATEWAY_PORT) || 4000;
  await app.listen(port, '0.0.0.0');

  const protocol = httpsOptions ? 'https' : 'http';
  console.log(`🚀 API Gateway running on: ${protocol}://0.0.0.0:${port}`);
  console.log(`📚 API Documentation: ${protocol}://0.0.0.0:${port}/api/docs`);
}

bootstrap();
