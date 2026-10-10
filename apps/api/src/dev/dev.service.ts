/**
 * Dev/test only: the logic behind the dev identity switcher. It bypasses passwords and 2FA,
 * so it must never run in production: DevModule is only loaded when DEV_LOGIN=true outside
 * production (see dev.module.ts).
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { AuthService, type SignInResult } from '../auth/auth.service';
import type { ClientInfo } from '../auth/tokens.service';
import { PrismaService } from '../prisma/prisma.service';
import { randomCharacter } from '../workspace/characters';
import { DesksService } from '../workspace/desks.service';

const FIRST_NAMES = ['Ada', 'Linus', 'Grace', 'Alan', 'Margaret', 'Dennis', 'Barbara', 'Ken', 'Radia', 'Tim', 'Hedy', 'Guido'];
const LAST_NAMES = ['Byte', 'Kernel', 'Stack', 'Pixel', 'Cache', 'Socket', 'Query', 'Cursor', 'Patch', 'Commit'];
/** The switcher lists at most this many users (oldest first); plenty for a dev database. */
const MAX_LISTED_USERS = 200;

export interface DevUser {
  id: string;
  displayName: string;
  email: string;
  officeName: string | null;
  role: string | null;
}

/** Sign in as any user in one click, or create a throwaway one. */
@Injectable()
export class DevService implements OnModuleInit {
  private readonly logger = new Logger('Dev');

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly desks: DesksService,
  ) {}

  onModuleInit() {
    this.logger.warn('!!! DEV_LOGIN is ON: anyone who can reach this server can sign in as any user. Never use it in production. !!!');
  }

  /** Every user with their office and role, for the switcher list. */
  async list(): Promise<DevUser[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      take: MAX_LISTED_USERS,
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

  /** Signs in as this user (taking the account over from any other device). */
  login(userId: string, client: ClientInfo): Promise<SignInResult> {
    return this.auth.devSignIn(userId, client);
  }

  /**
   * Creates a verified user with a random name and no password. With `joinUserId`
   * the new user joins that person's office with a random character and a free desk.
   */
  async createUser(name: string | undefined, joinUserId: string | undefined, client: ClientInfo): Promise<SignInResult> {
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
}
