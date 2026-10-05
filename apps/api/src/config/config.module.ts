import { Global, Module } from '@nestjs/common';
import { AppConfig } from './app-config';

@Global()
@Module({
  providers: [{ provide: AppConfig, useFactory: () => new AppConfig(process.env) }],
  exports: [AppConfig],
})
export class ConfigModule {}
