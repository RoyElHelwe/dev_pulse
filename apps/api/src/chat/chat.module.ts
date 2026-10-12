/**
 * NestJS module wiring controllers, gateways, and services for office text chat.
 * Bundles persistence with real-time socket events and spatial access control.
 */

import { Module } from '@nestjs/common';
import { MeetingsModule } from '../meetings/meetings.module';
import { OfficeModule } from '../office/office.module';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';

/** Configures HTTP and WebSocket communication layers for workspace and room text chat. */
@Module({
  imports: [OfficeModule, MeetingsModule],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
})
export class ChatModule {}

