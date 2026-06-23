import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { config } from '../config';
import { TraceContext } from '../observability/trace-context.context';
import { AuthenticatedRequest, JwtPayload, Role } from './auth.types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedRoles = new Set<string>(Object.values(Role));

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly traceContext: TraceContext,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    request.user = await this.authenticateRequest(request);
    request.authMode = 'JWT';
    this.traceContext.setUserId(request.user.sub);
    return true;
  }

  async authenticateRequest(request: AuthenticatedRequest): Promise<JwtPayload> {
    const match = /^Bearer\s+(.+)$/i.exec(request.headers.authorization ?? '');
    if (!match?.[1]) {
      throw new UnauthorizedException({ code: 'MISSING_BEARER_TOKEN', message: 'Bearer token is required.' });
    }

    try {
      const raw = await this.jwt.verifyAsync<JwtPayload>(match[1], {
        secret: config.jwtSecret,
        issuer: config.jwtIssuer,
        audience: config.jwtAudience,
        algorithms: ['HS256'],
      });
      return this.normalize(raw);
    } catch {
      throw new UnauthorizedException({ code: 'INVALID_ACCESS_TOKEN', message: 'Access token is invalid, expired or malformed.' });
    }
  }

  private normalize(raw: JwtPayload): JwtPayload {
    if (!raw.sub || !UUID.test(raw.sub)) throw new UnauthorizedException({ code: 'INVALID_JWT_SUBJECT' });
    if (!Array.isArray(raw.roles) || raw.roles.length === 0 || raw.roles.some((role) => !allowedRoles.has(role))) {
      throw new UnauthorizedException({ code: 'INVALID_JWT_ROLES' });
    }
    return {
      sub: raw.sub,
      roles: raw.roles,
      clinicIds: this.normalizeIds(raw.clinicIds),
      locationIds: this.normalizeIds(raw.locationIds),
      iat: raw.iat,
      exp: raw.exp,
      nbf: raw.nbf,
    };
  }

  private normalizeIds(values: string[] | undefined): string[] | undefined {
    if (values === undefined) return undefined;
    if (!Array.isArray(values) || values.some((value) => !UUID.test(value))) {
      throw new UnauthorizedException({ code: 'INVALID_JWT_SCOPE' });
    }
    return [...new Set(values)];
  }
}
