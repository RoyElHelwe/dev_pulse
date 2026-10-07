import { SetMetadata } from "@nestjs/common";

// The roles Better Auth's organization plugin uses (stored lowercase in workspaceMember.role)
export type WorkspaceRole = "owner" | "admin" | "member";

export const ROLES_KEY = "workspaceRoles";

/**
 * Only these roles can use the route. Use it together with WorkspaceMemberGuard.
 *
 *   @Roles("owner", "admin")
 *   @UseGuards(WorkspaceMemberGuard)
 *   @Delete("workspaces/:workspaceId/members/:memberId")
 */
export const Roles = (...roles: WorkspaceRole[]) => SetMetadata(ROLES_KEY, roles);