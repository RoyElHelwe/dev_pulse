import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Connect to NATS as microservice
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.NATS,
    options: {
      servers: [process.env.NATS_URL!],
    },
  });

  await app.startAllMicroservices();

  // Also expose HTTP for health checks
  const port = Number(process.env.PORT) || 3003;
  await app.listen(port, '0.0.0.0');

  console.log(`Task Service is running on: ${await app.getUrl()}`);
  console.log(`Connected to NATS: ${process.env.NATS_URL}`);
}

bootstrap();
