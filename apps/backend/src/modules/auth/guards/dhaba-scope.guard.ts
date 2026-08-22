import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * Enforces that a caller only reaches resources inside their own dhaba tenant.
 *
 * Fails closed: the caller's tenant comes from the access token alone. Defaulting
 * a missing `dhabaId` to a concrete tenant would both make the check below dead
 * code and silently grant every tenant-less caller access to that one dhaba.
 */
@Injectable()
export class DhabaScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const userDhabaId = req.user?.dhabaId;
    const resourceDhabaId = req.params?.dhabaId || req.body?.dhabaId || req.query?.dhabaId;

    if (!userDhabaId) {
      throw new ForbiddenException('Missing dhaba tenant context');
    }

    if (resourceDhabaId && resourceDhabaId !== userDhabaId) {
      throw new ForbiddenException('Tenant access mismatch: Access to this dhaba is restricted');
    }

    return true;
  }
}
