/**
 * Meeting room tools module: screen sharing and the shared whiteboard.
 * Builds on office positions and meeting bookings for access control.
 */

import { Module } from '@nestjs/common';
import { MeetingsModule } from '../meetings/meetings.module';
import { OfficeModule } from '../office/office.module';
import { RoomAccess } from './room-access';
import { ScreenGateway } from './screen.gateway';
import { WhiteboardGateway } from './whiteboard.gateway';
import { WhiteboardService } from './whiteboard.service';

/** Registers the screen share and whiteboard gateways on the /office socket. */
@Module({
  imports: [OfficeModule, MeetingsModule],
  providers: [RoomAccess, ScreenGateway, WhiteboardService, WhiteboardGateway],
})
export class MeetingRoomModule {}
