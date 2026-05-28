import { Injectable, CanActivate, ExecutionContext, ForbiddenException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

const roleHierarchy: Record<UserRole, number> = {
  [UserRole.VIEWER]: 0,
  [UserRole.MODERATOR]: 1,
  [UserRole.STREAMER]: 2,
  [UserRole.ADMIN]: 3,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) throw new ForbiddenException('Authentication required');

    const userLevel = roleHierarchy[user.role as UserRole] ?? -1;
    const hasRole = requiredRoles.some((role) => userLevel >= roleHierarchy[role]);

    if (!hasRole) throw new ForbiddenException('Insufficient permissions');

    return true;
  }
}
