import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout, catchError, of } from 'rxjs';

export interface NatsResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

@Injectable()
export class NatsClientService implements OnModuleDestroy {
  private readonly logger = new Logger(NatsClientService.name);
  private client: ClientProxy | null = null;

  setClient(client: ClientProxy) {
    this.client = client;
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.close();
    }
  }

  /**
   * Send a message and wait for response (request-reply pattern)
   */
  async send<TResult = unknown, TInput = unknown>(
    pattern: string,
    data: TInput,
    timeoutMs = 5000,
  ): Promise<NatsResponse<TResult>> {
    if (!this.client) {
      this.logger.error('NATS client not initialized');
      return { success: false, error: 'NATS client not initialized' };
    }

    try {
      const result = await firstValueFrom(
        this.client.send<TResult, TInput>(pattern, data).pipe(
          timeout(timeoutMs),
          catchError((error) => {
            this.logger.error(`NATS send error for ${pattern}: ${error.message}`);
            return of(null);
          }),
        ),
      );

      if (result === null) {
        return { success: false, error: 'Request failed' };
      }

      return { success: true, data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`NATS send failed for ${pattern}: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Emit an event (fire-and-forget pattern)
   */
  emit<TInput = unknown>(pattern: string, data: TInput): void {
    if (!this.client) {
      this.logger.error('NATS client not initialized');
      return;
    }

    try {
      this.client.emit(pattern, data);
      this.logger.debug(`Event emitted: ${pattern}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`NATS emit failed for ${pattern}: ${errorMessage}`);
    }
  }
}
