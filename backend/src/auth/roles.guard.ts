import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedRequest, Role } from './auth.types';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      throw new UnauthorizedException({ code: 'AUTH_PRINCIPAL_MISSING', message: 'Authenticated principal is missing.' });
    }
    if (!required.some((role) => request.user!.roles.includes(role))) {
      throw new ForbiddenException({ code: 'ROLE_FORBIDDEN', message: 'The current principal has no required role.', requiredRoles: required });
    }
    return true;
  }
}
