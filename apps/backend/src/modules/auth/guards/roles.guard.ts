import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Enforces `@Roles(...)`.
 *
 * Fails closed in two ways that matter:
 *   - No authenticated user on the request → 401, never "allow".
 *   - A route with `@Roles()` and an empty list → nobody passes, rather than
 *     everybody, so a typo cannot silently open an endpoint.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles() on the route: authentication alone is the requirement.
    if (required === undefined) return true;

    const request = context.switchToHttp().getRequest<{ user?: { role?: Role | string } }>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Authentication is required for this action.');
    }

    if (!user.role || !required.includes(user.role as Role)) {
      throw new ForbiddenException('Your account does not have access to this action.');
    }
    return true;
  }
}
