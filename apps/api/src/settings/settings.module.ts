/**
 * NestJS module wiring controllers and services for user settings and keybindings.
 * Provides endpoints for configuring voice interaction and keyboard controls.
 */

import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

/** NestJS module managing user audio preferences and custom keybindings. */
@Module({
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}

