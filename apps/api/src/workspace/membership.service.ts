import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export const CAN_MANAGE: Role[] = ['OWNER', 'ADMIN'];

/** "Which workspace is this user in, and may they do this?" (one workspace per user). */
@Injectable()
export class MembershipService {
  constructor(private readonly prisma: PrismaService) {}

  find(userId: string) {
    return this.prisma.workspaceMember.findUnique({ where: { userId }, include: { workspace: true } });
  }

  /** The user's membership, or 403 if they have no workspace or not one of these roles. */
  async require(userId: string, roles?: Role[]) {
    const member = await this.find(userId);
    if (!member) throw new ForbiddenException({ code: 'NO_WORKSPACE', message: 'You are not in a workspace yet.' });
    if (roles && !roles.includes(member.role)) {
      throw new ForbiddenException({ code: 'NOT_ALLOWED', message: 'Only the organiser can do this.' });
    }
    return member;
  }
}
