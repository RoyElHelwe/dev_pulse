/** Dev-only code must be absent unless DEV_LOGIN=true outside production. */
import { MODULE_METADATA } from '@nestjs/common/constants';
import { describe, expect, it, vi } from 'vitest';
import type { Socket } from 'socket.io';
import { isDevLoginEnabled } from '../config/app-config';
import { DevController } from './dev.controller';
import { DevGateway } from './dev.gateway';
import { DevModule, devImports } from './dev.module';

describe('DEV_LOGIN flag', () => {
  it('is off by default and for anything but "true"', () => {
    expect(isDevLoginEnabled({})).toBe(false);
    expect(isDevLoginEnabled({ DEV_LOGIN: 'yes' })).toBe(false);
    expect(isDevLoginEnabled({ DEV_LOGIN: 'false' })).toBe(false);
  });

  it('turns on only with DEV_LOGIN=true outside production', () => {
    expect(isDevLoginEnabled({ DEV_LOGIN: 'true' })).toBe(true);
    expect(isDevLoginEnabled({ DEV_LOGIN: 'true', NODE_ENV: 'production' })).toBe(false);
  });
});

describe('DevModule', () => {
  it('is left out of the app unless the flag is effective', () => {
    expect(devImports({})).toEqual([]);
    expect(devImports({ DEV_LOGIN: 'true', NODE_ENV: 'production' })).toEqual([]);
    expect(devImports({ DEV_LOGIN: 'true' })).toEqual([DevModule]);
  });

  it('owns the dev routes and the dev:teleport handler', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, DevModule)).toEqual([DevController]);
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, DevModule)).toContain(DevGateway);
  });
});

describe('DevGateway', () => {
  it('hands dev:teleport to the office gateway', () => {
    const office = { teleport: vi.fn() };
    const socket = {} as Socket;
    new DevGateway(office as never).teleport(socket, [1, 2]);
    expect(office.teleport).toHaveBeenCalledWith(socket, [1, 2]);
  });
});
