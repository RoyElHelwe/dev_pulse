import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { Role } from '../decorators/roles.decorator';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  const mockExecutionContext = (user: unknown, roles: Role[] | undefined): ExecutionContext => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;

    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(roles);

    return mockContext;
  };

  it('should allow access when no roles are required', () => {
    const context = mockExecutionContext({ id: '1', role: 'MEMBER' }, undefined);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access when user has required role', () => {
    const context = mockExecutionContext({ id: '1', role: 'ADMIN' }, [Role.ADMIN]);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access when user has higher role than required', () => {
    const context = mockExecutionContext({ id: '1', role: 'OWNER' }, [Role.MEMBER]);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny access when user has lower role than required', () => {
    const context = mockExecutionContext({ id: '1', role: 'VIEWER' }, [Role.ADMIN]);
    expect(guard.canActivate(context)).toBe(false);
  });

  it('should deny access when user has no role', () => {
    const context = mockExecutionContext({ id: '1' }, [Role.MEMBER]);
    expect(guard.canActivate(context)).toBe(false);
  });

  it('should deny access when there is no user', () => {
    const context = mockExecutionContext(null, [Role.MEMBER]);
    expect(guard.canActivate(context)).toBe(false);
  });
});
