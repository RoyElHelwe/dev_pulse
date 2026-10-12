/**
 * HTTP controller exposing personal user settings and keybind preferences.
 * Requires user authentication to inspect and update preferences.
 */

import { Body, Controller, Get, Patch } from '@nestjs/common';
import type { AuthUser } from '../common/auth/auth-user';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { UpdateSettingsDto } from './settings.dto';
import { SettingsService } from './settings.service';

/** REST controller managing the authenticated user's audio and keybind configurations. */
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.settings.get(user.id);
  }

  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateSettingsDto) {
    return this.settings.update(user.id, dto);
  }
}

