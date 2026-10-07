import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthUser } from "./auth-user.js";

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
	const req = context.switchToHttp().getRequest();
	return req.user;
  },
);
