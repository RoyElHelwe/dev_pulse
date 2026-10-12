/**
 * Service managing user settings persistence, voice modes, and customized keybindings.
 * Persists sparse diffs against defaults in Prisma to allow default keybind updates to propagate.
 */

import { Injectable } from '@nestjs/common';
import { VoiceMode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { UpdateSettingsDto } from './settings.dto';
import {
  type Action,
  ACTIONS,
  applyKeybindChanges,
  DEFAULT_KEYBINDS,
  resolveKeybinds,
} from './keybinds';

/** Fully resolved user settings including voice mode and active keybinding map. */
export interface Settings {
  voiceMode: VoiceMode;
  pushToTalkKey: string;
  keybinds: Record<Action, string>;
}

const DEFAULTS: Settings = {
  voiceMode: VoiceMode.OPEN,
  pushToTalkKey: DEFAULT_KEYBINDS.pushToTalk,
  keybinds: { ...DEFAULT_KEYBINDS },
};

/** Service handling retrieval and partial updates of user personal preferences and keybinds. */
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<Settings> {
    const row = await this.prisma.userSettings.findUnique({ where: { userId } });
    if (!row) return DEFAULTS;
    return {
      voiceMode: row.voiceMode,
      pushToTalkKey: row.pushToTalkKey,
      keybinds: resolveKeybinds(row.keybinds, row.pushToTalkKey),
    };
  }

  async update(userId: string, dto: UpdateSettingsDto): Promise<Settings> {
    const row = await this.prisma.userSettings.findUnique({ where: { userId } });
    let current = resolveKeybinds(row?.keybinds, row?.pushToTalkKey ?? DEFAULTS.pushToTalkKey);

    const changes: Record<string, unknown> = {
      ...dto.keybinds,
      ...(dto.pushToTalkKey !== undefined && { pushToTalk: dto.pushToTalkKey }),
    };

    if (Object.keys(changes).length > 0) {
      current = applyKeybindChanges(current, changes);
    }

    // Persist only overrides against defaults so future default keybind updates reach the user.
    const diffKeybinds: Record<string, string> = {};
    for (const action of ACTIONS) {
      if (action === 'pushToTalk') continue;
      if (current[action] !== DEFAULT_KEYBINDS[action]) {
        diffKeybinds[action] = current[action];
      }
    }

    const voiceMode = dto.voiceMode ?? row?.voiceMode ?? DEFAULTS.voiceMode;

    // Maintain pushToTalkKey column alongside keybinds JSON for backward schema compatibility.
    const saved = await this.prisma.userSettings.upsert({
      where: { userId },
      create: {
        userId,
        voiceMode,
        pushToTalkKey: current.pushToTalk,
        keybinds: diffKeybinds,
      },
      update: {
        ...(dto.voiceMode !== undefined && { voiceMode: dto.voiceMode }),
        pushToTalkKey: current.pushToTalk,
        keybinds: diffKeybinds,
      },
    });

    return {
      voiceMode: saved.voiceMode,
      pushToTalkKey: saved.pushToTalkKey,
      keybinds: resolveKeybinds(saved.keybinds, saved.pushToTalkKey),
    };
  }
}

