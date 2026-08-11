import { SetMetadata } from '@nestjs/common';
import type { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Restricts a route to the listed roles. Must be combined with `JwtAuthGuard`:
 * `RolesGuard` reads `request.user`, which only exists once JWT auth has run.
 *
 * @example
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles('admin')
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
