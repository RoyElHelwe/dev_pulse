import { Injectable } from '@nestjs/common';
import { VoiceMode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { UpdateSettingsDto } from './dto';

export interface Settings {
  voiceMode: VoiceMode;
  pushToTalkKey: string;
}

const DEFAULTS: Settings = { voiceMode: VoiceMode.OPEN, pushToTalkKey: 'KeyV' };

/** Personal preferences (voice for now). No row = the defaults. */
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<Settings> {
    const row = await this.prisma.userSettings.findUnique({ where: { userId } });
    return row ? { voiceMode: row.voiceMode, pushToTalkKey: row.pushToTalkKey } : DEFAULTS;
  }

  async update(userId: string, dto: UpdateSettingsDto): Promise<Settings> {
    const changes = { voiceMode: dto.voiceMode, pushToTalkKey: dto.pushToTalkKey };
    const row = await this.prisma.userSettings.upsert({
      where: { userId },
      create: { userId, ...changes },
      update: changes,
    });
    return { voiceMode: row.voiceMode, pushToTalkKey: row.pushToTalkKey };
  }
}
