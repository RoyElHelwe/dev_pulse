import { Module } from '@nestjs/common';
import { MeetingsModule } from '../meetings/meetings.module';
import { OfficeModule } from '../office/office.module';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';

/** Text chat in the office (whole office and per room). */
@Module({
  imports: [OfficeModule, MeetingsModule],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
})
export class ChatModule {}
