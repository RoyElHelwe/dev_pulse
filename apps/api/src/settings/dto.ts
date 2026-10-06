import { VoiceMode } from '@prisma/client';
import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsIn(Object.values(VoiceMode))
  voiceMode?: VoiceMode;

  /** KeyboardEvent.code: "KeyV", "Space", "Backquote"... */
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9]{1,24}$/, { message: 'Pick a key on your keyboard.' })
  pushToTalkKey?: string;
}
