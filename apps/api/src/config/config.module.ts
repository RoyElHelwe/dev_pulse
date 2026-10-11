/**
 * Configuration module.
 * Globally provides the validated application configuration instance parsed from environment variables.
 */
import { Global, Module } from '@nestjs/common';
import { AppConfig } from './app-config';

@Global()
@Module({
  providers: [{ provide: AppConfig, useFactory: () => new AppConfig(process.env) }],
  exports: [AppConfig],
})
/** Global module providing application-wide environment configuration. */
export class ConfigModule {}

