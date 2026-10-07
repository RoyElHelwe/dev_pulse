import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Membership } from "./membership.js";

/** The user's membership in this workspace (role, character...). Needs WorkspaceMemberGuard. */
export const CurrentMembership = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Membership => {
    return context.switchToHttp().getRequest().membership;
  },
);