import { NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { AppConfig } from '../config/app-config';
import { DevLoginService } from './dev-login.service';

const base = { JWT_SECRET: 'x'.repeat(40) };
const make = (env: NodeJS.ProcessEnv) => new DevLoginService(new AppConfig({ ...base, ...env }), {} as never, {} as never, {} as never);

describe('DEV_LOGIN', () => {
  it('is off by default and refuses every call', async () => {
    const dev = make({});
    expect(dev.enabled).toBe(false);
    await expect(dev.list()).rejects.toBeInstanceOf(NotFoundException);
    expect(() => dev.login('u', {} as never)).toThrow(NotFoundException);
    await expect(dev.createUser(undefined, undefined, {} as never)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('turns on only with DEV_LOGIN=true outside production', () => {
    expect(make({ DEV_LOGIN: 'true' }).enabled).toBe(true);
    expect(make({ DEV_LOGIN: 'yes' }).enabled).toBe(false);
    expect(make({ DEV_LOGIN: 'true', NODE_ENV: 'production' }).enabled).toBe(false);
  });
});
