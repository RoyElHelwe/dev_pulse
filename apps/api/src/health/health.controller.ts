/**
 * Health check controller.
 * Exposes a public GET /api/health endpoint used by Docker health checks and monitoring to verify database connectivity.
 */
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../common/auth/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
/** Public controller exposing stack health and database connectivity status. */
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // GET /api/health – used by Docker and the home page to check the stack.
  @Public()
  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({ status: 'error', db: 'down' });
    }
    return { status: 'ok', db: 'up', time: new Date().toISOString() };
  }
}

