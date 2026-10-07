// Everything the team imports from one place:
//   import { Public, CurrentUser, WorkspaceMemberGuard, Roles, ... } from "../common/auth/index.js";
export { AuthGuard } from "./auth.guard.js";
export { Public, IS_PUBLIC_KEY } from "./public.decorator.js";
export { CurrentUser } from "./current-user.decorator.js";
export { authenticateSocket } from "./socket-auth.js";
export { WorkspaceMemberGuard } from "./workspace-member.guard.js";
export { Roles, ROLES_KEY, type WorkspaceRole } from "./roles.decorator.js";
export { CurrentMembership } from "./current-membership.decorator.js";
export { getMembership, hasRole, type Membership } from "./membership.js";
export type { AuthUser, AuthSession } from "./auth-user.js";
//Collect exports from several files and expose them from one place