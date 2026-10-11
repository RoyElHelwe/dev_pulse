/**
 * Data transfer objects and validation schemas for user settings and keybind customization.
 * Validates voice input modes and raw KeyboardEvent.code strings received via REST API.
 */

import { VoiceMode } from '@prisma/client';
import { IsIn, IsObject, IsOptional, IsString, Matches } from 'class-validator';

const MAX_KEY_CODE_CHARS = 24;
const KEY_CODE_PATTERN = new RegExp(`^[A-Za-z0-9]{1,${MAX_KEY_CODE_CHARS}}$`);

/** Request payload for updating user audio settings and keybind preferences. */
export class UpdateSettingsDto {
  @IsOptional()
  @IsIn(Object.values(VoiceMode))
  voiceMode?: VoiceMode;

  /** KeyboardEvent.code: "KeyV", "Space", "Backquote"... */
  @IsOptional()
  @IsString()
  @Matches(KEY_CODE_PATTERN, { message: 'Pick a key on your keyboard.' })
  pushToTalkKey?: string;

  @IsOptional()
  @IsObject()
  keybinds?: Record<string, string>;
}

