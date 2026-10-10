/**
 * Dev/test only: everything that exists for local testing and browser tests (dev sign-in
 * switcher, dev:teleport). AppModule imports it through devImports(), which returns nothing
 * unless DEV_LOGIN=true outside production, so in production these routes and events do
 * not exist at all (404 / unknown event), rather than being present but refused.
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
export class DevModule {}

/** `[DevModule]` when the dev flag is effective for this environment, otherwise `[]`. */
export const devImports = (env: NodeJS.ProcessEnv): Type[] => (isDevLoginEnabled(env) ? [DevModule] : []);
