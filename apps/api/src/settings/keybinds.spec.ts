import { describe, expect, it, vi } from 'vitest';
import { VoiceMode } from '@prisma/client';
import { FormError } from '../common/form-error';
import {
  ACTIONS,
  applyKeybindChanges,
  DEFAULT_KEYBINDS,
  friendlyKeyName,
  LEGACY_ACTIONS,
  RESERVED,
  resolveKeybinds,
} from './keybinds';
import { SettingsService } from './settings.service';

describe('keybinds', () => {
  describe('friendlyKeyName', () => {
    it('strips Key and Digit prefixes when followed by character', () => {
      expect(friendlyKeyName('KeyB')).toBe('B');
      expect(friendlyKeyName('KeyV')).toBe('V');
      expect(friendlyKeyName('Digit1')).toBe('1');
    });

    it('returns raw code for other keys', () => {
      expect(friendlyKeyName('Space')).toBe('Space');
      expect(friendlyKeyName('Escape')).toBe('Escape');
    });
  });

  describe('resolve defaults', () => {
    it('returns default keybinds when stored is empty, null, or undefined', () => {
      expect(resolveKeybinds({}, 'KeyV')).toEqual(DEFAULT_KEYBINDS);
      expect(resolveKeybinds(null, 'KeyV')).toEqual(DEFAULT_KEYBINDS);
      expect(resolveKeybinds(undefined, 'KeyV')).toEqual(DEFAULT_KEYBINDS);
    });
  });

  describe('ignores junk', () => {
    it('ignores non-object stored values', () => {
      expect(resolveKeybinds('invalid string', 'KeyV')).toEqual(DEFAULT_KEYBINDS);
      expect(resolveKeybinds(12345, 'KeyV')).toEqual(DEFAULT_KEYBINDS);
      expect(resolveKeybinds(['array'], 'KeyV')).toEqual(DEFAULT_KEYBINDS);
    });

    it('ignores unknown actions, non-string, invalid, or reserved keys', () => {
      const junk = {
        unknownAction: 'KeyX',
        interact: 123,
        mute: 'invalid!code',
        deafen: 'KeyW', // reserved
        chat: 'KeyJ', // valid
      };
      const resolved = resolveKeybinds(junk, 'KeyV');
      expect(resolved.chat).toBe('KeyJ');
      expect(resolved.interact).toBe(DEFAULT_KEYBINDS.interact);
      expect(resolved.mute).toBe(DEFAULT_KEYBINDS.mute);
      expect(resolved.deafen).toBe(DEFAULT_KEYBINDS.deafen);
      expect((resolved as any).unknownAction).toBeUndefined();
    });

    it('ignores legacy foosKick and foosSwitch stored keys and does not return them', () => {
      const stored = {
        foosKick: 'Space',
        foosSwitch: 'KeyQ',
        chat: 'KeyJ',
      };
      const resolved = resolveKeybinds(stored, 'KeyV');
      expect(resolved.chat).toBe('KeyJ');
      expect((resolved as any).foosKick).toBeUndefined();
      expect((resolved as any).foosSwitch).toBeUndefined();
      expect(Object.keys(resolved)).not.toContain('foosKick');
      expect(Object.keys(resolved)).not.toContain('foosSwitch');
    });
  });

  describe('PTT overlay', () => {
    it('always overlays pushToTalk with pushToTalkKey column value', () => {
      const stored = { pushToTalk: 'KeyX', chat: 'KeyJ' };
      const resolved = resolveKeybinds(stored, 'KeyT');
      expect(resolved.pushToTalk).toBe('KeyT');
      expect(resolved.chat).toBe('KeyJ');
    });

    it('uses pushToTalkKey even when stored is empty', () => {
      const resolved = resolveKeybinds({}, 'KeyZ');
      expect(resolved.pushToTalk).toBe('KeyZ');
    });
  });

  describe('apply ok', () => {
    it('updates a single key successfully', () => {
      const next = applyKeybindChanges(DEFAULT_KEYBINDS, { interact: 'KeyF' });
      expect(next.interact).toBe('KeyF');
      expect(next.chat).toBe(DEFAULT_KEYBINDS.chat);
    });

    it('updates multiple keys successfully', () => {
      const next = applyKeybindChanges(DEFAULT_KEYBINDS, {
        interact: 'KeyF',
        chat: 'KeyJ',
      });
      expect(next.interact).toBe('KeyF');
      expect(next.chat).toBe('KeyJ');
    });

    it('allows keeping existing key unchanged', () => {
      const next = applyKeybindChanges(DEFAULT_KEYBINDS, { interact: DEFAULT_KEYBINDS.interact });
      expect(next.interact).toBe(DEFAULT_KEYBINDS.interact);
    });

    it('allows swapping two keys simultaneously', () => {
      // In DEFAULT_KEYBINDS: chat is KeyC, board is KeyB
      const next = applyKeybindChanges(DEFAULT_KEYBINDS, {
        chat: 'KeyB',
        board: 'KeyC',
      });
      expect(next.chat).toBe('KeyB');
      expect(next.board).toBe('KeyC');
    });

    it('silently ignores legacy actions foosKick and foosSwitch without error', () => {
      const next = applyKeybindChanges(DEFAULT_KEYBINDS, {
        foosKick: 'Space',
        foosSwitch: 'KeyQ',
        interact: 'KeyF',
      });
      expect(next.interact).toBe('KeyF');
      expect((next as any).foosKick).toBeUndefined();
      expect((next as any).foosSwitch).toBeUndefined();
    });

    it('silently ignores legacy actions when they are the only keys submitted', () => {
      const next = applyKeybindChanges(DEFAULT_KEYBINDS, {
        foosKick: 'Space',
        foosSwitch: 'KeyQ',
      });
      expect(next).toEqual(DEFAULT_KEYBINDS);
    });
  });

  describe('rejects unknown/reserved/duplicate/invalid', () => {
    it('rejects unknown action with FormError', () => {
      expect(() =>
        applyKeybindChanges(DEFAULT_KEYBINDS, { jump: 'KeyJ' }),
      ).toThrow(FormError);
    });

    it('rejects reserved keys with FormError', () => {
      for (const reservedKey of RESERVED) {
        expect(() =>
          applyKeybindChanges(DEFAULT_KEYBINDS, { interact: reservedKey }),
        ).toThrow(FormError);
      }
    });

    it('rejects duplicate key sharing with another action', () => {
      // In DEFAULT_KEYBINDS, chat is KeyC
      try {
        applyKeybindChanges(DEFAULT_KEYBINDS, { interact: 'KeyC' });
        expect.unreachable('should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(FormError);
        expect(err.getResponse().error.message).toBe('C is already used for Chat.');
      }

      // If chat is bound to KeyB, rebind interact to KeyB
      const custom = { ...DEFAULT_KEYBINDS, chat: 'KeyB', board: 'KeyX' };
      try {
        applyKeybindChanges(custom, { interact: 'KeyB' });
        expect.unreachable('should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(FormError);
        expect(err.getResponse().error.message).toBe('B is already used for Chat.');
      }
    });

    it('rejects two changes sharing the same key', () => {
      expect(() =>
        applyKeybindChanges(DEFAULT_KEYBINDS, { interact: 'KeyZ', chat: 'KeyZ' }),
      ).toThrow(FormError);
    });

    it('rejects invalid key code format with FormError', () => {
      expect(() =>
        applyKeybindChanges(DEFAULT_KEYBINDS, { interact: 'bad-key!' }),
      ).toThrow(FormError);

      expect(() =>
        applyKeybindChanges(DEFAULT_KEYBINDS, { interact: '' }),
      ).toThrow(FormError);

      expect(() =>
        applyKeybindChanges(DEFAULT_KEYBINDS, { interact: 1234 as any }),
      ).toThrow(FormError);
    });

    it('rejects non-object changes with FormError', () => {
      expect(() =>
        applyKeybindChanges(DEFAULT_KEYBINDS, null as any),
      ).toThrow(FormError);
    });
  });

  describe('SettingsService', () => {
    it('returns defaults when user has no settings row', async () => {
      const fakePrisma: any = {
        userSettings: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      };
      const service = new SettingsService(fakePrisma);
      const result = await service.get('user-1');
      expect(result).toEqual({
        voiceMode: VoiceMode.OPEN,
        pushToTalkKey: 'KeyV',
        keybinds: DEFAULT_KEYBINDS,
      });
    });

    it('updates keybinds, diffing defaults and storing PTT in column', async () => {
      let savedData: any = null;
      const fakePrisma: any = {
        userSettings: {
          findUnique: vi.fn().mockResolvedValue({
            userId: 'user-1',
            voiceMode: VoiceMode.OPEN,
            pushToTalkKey: 'KeyV',
            keybinds: {},
          }),
          upsert: vi.fn().mockImplementation(async ({ update }: any) => {
            savedData = update;
            return {
              userId: 'user-1',
              voiceMode: VoiceMode.OPEN,
              ...update,
            };
          }),
        },
      };
      const service = new SettingsService(fakePrisma);
      const result = await service.update('user-1', {
        pushToTalkKey: 'KeyT',
        keybinds: { interact: 'KeyF', rooms: 'KeyG' },
      });

      expect(savedData.pushToTalkKey).toBe('KeyT');
      expect(savedData.keybinds).toEqual({
        interact: 'KeyF',
        rooms: 'KeyG',
      });
      expect(result.pushToTalkKey).toBe('KeyT');
      expect(result.keybinds.interact).toBe('KeyF');
      expect(result.keybinds.rooms).toBe('KeyG');
      expect(result.keybinds.pushToTalk).toBe('KeyT');
      expect(result.keybinds.chat).toBe(DEFAULT_KEYBINDS.chat);
    });
  });
});
