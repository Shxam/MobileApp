import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class DhabaScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const userDhabaId = req.user?.dhabaId || 'dhaba_singarayakonda';
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
