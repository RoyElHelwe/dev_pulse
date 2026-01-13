import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  // Microservices use HTTP for internal Docker communication
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      
      // Allow configured origins or any origin in development
      const allowedOrigin = process.env.FRONTEND_URL;
      const hostIp = process.env.COOKIE_DOMAIN || process.env.HOST_IP;
      if (!allowedOrigin || origin.includes('localhost') || origin.includes('127.0.0.1') || (hostIp && origin.includes(hostIp))) {
        callback(null, true);
      } else {
        callback(null, allowedOrigin === origin);
      }
    },
    credentials: true,
  });

  // Enable cookie parser
  app.use(cookieParser());

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Setup Swagger
  const config = new DocumentBuilder()
    .setTitle('Auth Service API')
    .setDescription('Authentication microservice API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // Connect to NATS microservice
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.NATS,
    options: {
      servers: [process.env.NATS_URL!],
    },
  });

  await app.startAllMicroservices();
  await app.listen(Number(process.env.AUTH_PORT) || 3001, '0.0.0.0');

  console.log(`Auth service is running on: ${await app.getUrl()}`);
}
bootstrap();
