import { prisma } from "../../lib/prisma.js";
import type { WorkspaceRole } from "./roles.decorator.js";

/** The user's row in workspaceMember, or null if they're not in that workspace. */
export async function getMembership(userId: string, workspaceId: string) {
  return prisma.workspaceMember.findFirst({ where: { userId, workspaceId } });
}

export type Membership = NonNullable<Awaited<ReturnType<typeof getMembership>>>;

/** True if the member has one of the roles. No roles given = any member is fine. */
export function hasRole(membership: Membership, roles: WorkspaceRole[]): boolean {
  if (roles.length === 0) return true;
  // Better Auth can store several roles as "admin,member"
  const mine = membership.role.split(",").map((r) => r.trim());
  return roles.some((r) => mine.includes(r));
}