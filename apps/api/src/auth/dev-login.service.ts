import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { AppConfig } from '../config/app-config';
import { PrismaService } from '../prisma/prisma.service';
import { randomCharacter } from '../workspace/characters';
import { DesksService } from '../workspace/desks.service';
import { AuthService, type SignInResult } from './auth.service';
import type { ClientInfo } from './tokens.service';

const FIRST_NAMES = ['Ada', 'Linus', 'Grace', 'Alan', 'Margaret', 'Dennis', 'Barbara', 'Ken', 'Radia', 'Tim', 'Hedy', 'Guido'];
const LAST_NAMES = ['Byte', 'Kernel', 'Stack', 'Pixel', 'Cache', 'Socket', 'Query', 'Cursor', 'Patch', 'Commit'];

export interface DevUser {
  id: string;
  displayName: string;
  email: string;
  officeName: string | null;
  role: string | null;
}

/**
 * Dev identity switcher (DEV_LOGIN=true). Lets you sign in as any user in one
 * click, or create a throwaway one. Testing aid: it bypasses passwords and 2FA,
 * so every method refuses (404) unless the flag is on.
 */
@Injectable()
export class DevLoginService implements OnModuleInit {
  private readonly logger = new Logger('DevLogin');

  constructor(
    private readonly config: AppConfig,
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly desks: DesksService,
  ) {}

  onModuleInit() {
    if (!this.config.devLogin) return;
    this.logger.warn('!!! DEV_LOGIN is ON: anyone who can reach this server can sign in as any user. Never use it in production. !!!');
  }

  get enabled() {
    return this.config.devLogin;
  }

  async list(): Promise<DevUser[]> {
    this.assertEnabled();
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      take: 200,
      include: { membership: { include: { workspace: true } } },
    });
    return users.map((u) => ({
      id: u.id,
      displayName: u.displayName,
      email: u.email,
      officeName: u.membership?.workspace.name ?? null,
      role: u.membership?.role ?? null,
    }));
  }

  login(userId: string, client: ClientInfo): Promise<SignInResult> {
    this.assertEnabled();
    return this.auth.devSignIn(userId, client);
  }

  /**
   * Creates a verified user with a random name and no password. With `joinUserId`
   * the new user joins that person's office with a random character and a free desk.
   */
  async createUser(name: string | undefined, joinUserId: string | undefined, client: ClientInfo): Promise<SignInResult> {
    this.assertEnabled();
    const pick = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)];
    const displayName = name?.trim() || `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    const email = `dev-${randomBytes(4).toString('hex')}@devpulse.test`;
    const user = await this.prisma.user.create({ data: { email, displayName, emailVerifiedAt: new Date() } });

    if (joinUserId) {
      const host = await this.prisma.workspaceMember.findUnique({ where: { userId: joinUserId } });
      if (host) {
        await this.prisma.workspaceMember.create({
          data: { userId: user.id, workspaceId: host.workspaceId, role: 'MEMBER', character: randomCharacter() },
        });
        await this.desks.sync(host.workspaceId);
      }
    }
    return this.auth.devSignIn(user.id, client);
  }

  private assertEnabled() {
    if (!this.config.devLogin) throw new NotFoundException();
  }
}
