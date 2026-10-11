/**
 * Voice module configuring WebRTC signalling infrastructure and proximity audio relay.
 * Bridges office positioning and meeting room permissions with real-time audio sockets.
 */

import { Module } from '@nestjs/common';
import { MeetingsModule } from '../meetings/meetings.module';
import { OfficeModule } from '../office/office.module';
import { VoiceGateway } from './voice.gateway';

/** NestJS module providing proximity voice signalling and mute state coordination. */
@Module({
  imports: [OfficeModule, MeetingsModule],
  providers: [VoiceGateway],
})
export class VoiceModule {}

