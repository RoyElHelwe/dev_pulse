/**
 * NestJS module packaging virtual office presence controllers, gateway providers, and spatial state.
 * Bundles WebSocket real-time events and template endpoints into the core application.
 */

import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OfficeController } from './office.controller';
import { OfficeGateway } from './office.gateway';

/** Module coordinating real-time office presence, layout templates, and gateway messaging. */
@Module({
  imports: [AuthModule],
  controllers: [OfficeController],
  providers: [OfficeGateway],
  exports: [OfficeGateway],
})
export class OfficeModule {}
