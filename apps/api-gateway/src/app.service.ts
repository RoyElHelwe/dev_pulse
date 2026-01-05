import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth(): object {
    return {
      status: 'ok',
      service: 'api-gateway',
      timestamp: new Date().toISOString(),
    };
  }

  getDetailedHealth(): object {
    return {
      status: 'ok',
      service: 'api-gateway',
      version: '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
    };
  }
}
