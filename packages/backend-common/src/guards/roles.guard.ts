import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, Role } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.role) {
      return false;
    }

    // Role hierarchy: OWNER > ADMIN > MANAGER > MEMBER > VIEWER
    const roleHierarchy: Record<Role, number> = {
      [Role.OWNER]: 5,
      [Role.ADMIN]: 4,
      [Role.MANAGER]: 3,
      [Role.MEMBER]: 2,
      [Role.VIEWER]: 1,
    };

    const userRoleLevel = roleHierarchy[user.role as Role] || 0;
    const requiredMinLevel = Math.min(
      ...requiredRoles.map((role) => roleHierarchy[role] || 0),
    );

    return userRoleLevel >= requiredMinLevel;
  }
}
