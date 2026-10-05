import { Module } from '@nestjs/common';
import { MeetingsModule } from '../meetings/meetings.module';
import { OfficeModule } from '../office/office.module';
import { VoiceGateway } from './voice.gateway';

/** Proximity voice: WebRTC signaling relay and who is muted (see VoiceGateway). */
@Module({
  imports: [OfficeModule, MeetingsModule],
  providers: [VoiceGateway],
})
export class VoiceModule {}
