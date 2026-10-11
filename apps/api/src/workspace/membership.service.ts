/**
 * Service verifying workspace membership and role-based permissions across API endpoints.
 */

import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Roles permitted to perform administrative workspace management actions. */
export const CAN_MANAGE: Role[] = ['OWNER', 'ADMIN'];

/** Verifies user participation in workspaces and enforces role authorization checks. */
@Injectable()
export class MembershipService {
  constructor(private readonly prisma: PrismaService) {}

  /** Finds the workspace membership record for a given user if one exists. */
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

