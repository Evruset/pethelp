import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { config } from '../config';
import { AuthenticatedRequest, Role } from './auth.types';
import { JwtAuthGuard } from './jwt-auth.guard';

@Injectable()
export class WorkerAuthGuard implements CanActivate {
  constructor(private readonly jwtAuthGuard: JwtAuthGuard) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization ?? '';

    if (authorization.startsWith('ServiceBearer ')) {
      const value = authorization.slice('ServiceBearer '.length).trim();
      if (!this.isExpectedServiceToken(value)) {
        throw new UnauthorizedException({ code: 'INVALID_SERVICE_TOKEN', message: 'Service token is invalid.' });
      }
      request.authMode = 'SERVICE';
      return true;
    }

    const principal = await this.jwtAuthGuard.authenticateRequest(request);
    if (!principal.roles.includes(Role.SYSTEM_WORKER)) {
      throw new ForbiddenException({ code: 'SYSTEM_WORKER_ROLE_REQUIRED', message: 'SYSTEM_WORKER role is required.' });
    }
    request.user = principal;
    request.authMode = 'JWT';
    return true;
  }

  private isExpectedServiceToken(value: string): boolean {
    const actual = Buffer.from(value);
    const expected = Buffer.from(config.workerServiceToken);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}
