/**
 * Configuration module.
 * Globally provides the validated application configuration instance parsed from environment variables.
 */
import { Global, Module } from '@nestjs/common';
import { AppConfig } from './app-config';

/** Globally provides validated environment configuration across all application domains. */
@Global()
@Module({
  providers: [{ provide: AppConfig, useFactory: () => new AppConfig(process.env) }],
  exports: [AppConfig],
})
export class ConfigModule {}

