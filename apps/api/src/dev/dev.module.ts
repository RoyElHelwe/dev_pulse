/**
 * Dev/test only module wiring dev identity switcher and test socket gateways.
 * Loaded conditionally via devImports() only when DEV_LOGIN=true in non-production environments.
 */
import { Module, type Type } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { isDevLoginEnabled } from '../config/app-config';
import { OfficeModule } from '../office/office.module';
import { DevController } from './dev.controller';
import { DevGateway } from './dev.gateway';
import { DevService } from './dev.service';

@Module({
  imports: [AuthModule, OfficeModule],
  controllers: [DevController],
  providers: [DevService, DevGateway],
})
/** Module packaging dev-only controllers and gateways for non-production environments. */
export class DevModule {}

/** Returns [DevModule] when dev login is enabled outside production, otherwise an empty array. */
export const devImports = (env: NodeJS.ProcessEnv): Type[] => (isDevLoginEnabled(env) ? [DevModule] : []);

