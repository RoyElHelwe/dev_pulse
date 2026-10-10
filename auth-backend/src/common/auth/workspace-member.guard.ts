import {BadRequestException,CanActivate,ExecutionContext,ForbiddenException,Injectable,UnauthorizedException,} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { AuthUser } from "./auth-user.js";
import { getMembership, hasRole, type Membership } from "./membership.js";
import { ROLES_KEY, type WorkspaceRole } from "./roles.decorator.js";

type WorkspaceRequest = Request & { user?: AuthUser; membership?: Membership };

/**
 * Checks that the signed-in user is a member of the workspace in the URL (:workspaceId),
 * and has the right role if the route has @Roles(...).
 * The global AuthGuard runs first, so req.user is already set.
 */
@Injectable()
export class WorkspaceMemberGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<WorkspaceRequest>();

    const user = req.user;
    if (!user) throw new UnauthorizedException("You are not signed in");

    // Every workspace route must use the name :workspaceId
        // Every workspace route must use the name :workspaceId
    const workspaceId = req.params.workspaceId;
    if (typeof workspaceId !== "string" || !workspaceId) {
      throw new BadRequestException("Route is missing :workspaceId");
    }

    const membership = await getMembership(user.id, workspaceId);
    if (!membership) throw new ForbiddenException("You are not a member of this workspace");

    const roles =
      this.reflector.getAllAndOverride<WorkspaceRole[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    if (!hasRole(membership, roles)) throw new ForbiddenException("Your role can't do this");

    // Hand it to the route (read by @CurrentMembership())
    req.membership = membership;
    return true;
  }
}
//401 not logged in
//403 logged in but not allowed forbidden