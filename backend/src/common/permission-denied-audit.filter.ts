import { ArgumentsHost, Catch, ExceptionFilter, ForbiddenException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import { TraceContext } from '../observability/trace-context.context';

type ErrorBody = string | {
  code?: unknown;
  message?: unknown;
  requiredRoles?: unknown;
  [key: string]: unknown;
};

@Catch(UnauthorizedException, ForbiddenException)
@Injectable()
export class PermissionDeniedAuditFilter implements ExceptionFilter {
  constructor(
    private readonly database: DatabaseService,
    private readonly traceContext: TraceContext,
  ) {}

  async catch(error: HttpException, host: ArgumentsHost): Promise<void> {
    const http = host.switchToHttp();
    const request = http.getRequest<AuthenticatedRequest>();
    const response = http.getResponse<Response>();
    const status = error.getStatus();
    const body = this.responseBody(error);

    await this.writeAudit(request, status, body);
    response.status(status).json(this.serialize(status, body));
  }

  private async writeAudit(request: AuthenticatedRequest, status: number, body: ErrorBody): Promise<void> {
    const correlationId = this.traceContext.getCorrelationId() ?? randomUUID();
    const code = typeof body === 'object' && typeof body.code === 'string'
      ? body.code
      : status === HttpStatus.UNAUTHORIZED ? 'UNAUTHORIZED' : 'FORBIDDEN';
    const actorId = request.user?.sub ?? null;
    const actorType = request.user?.roles[0] ?? 'ANONYMOUS';

    try {
      await this.database.withTransaction(async (client) => {
        await client.query("SET LOCAL statement_timeout = '100ms'");
        await client.query(`
          INSERT INTO audit_schema.audit_log (
            actor_type, actor_id, action, aggregate_type, aggregate_id,
            correlation_id, causation_id, traceparent, payload_json
          ) VALUES (
            $1, $2, 'permission.denied', 'http_request', $3::uuid,
            $3::uuid, $4::uuid, $5, $6::jsonb
          )
        `, [
          actorType,
          actorId,
          correlationId,
          this.traceContext.getCausationId() ?? null,
          this.traceContext.getTraceparent() ?? null,
          JSON.stringify({
            method: request.method,
            path: request.path,
            statusCode: status,
            code,
            authMode: request.authMode ?? null,
            requiredRoles: typeof body === 'object' && Array.isArray(body.requiredRoles) ? body.requiredRoles : undefined,
          }),
        ]);
      });
    } catch {
      // Permission-denied audit is best-effort and must not mask the original response.
    }
  }

  private responseBody(error: HttpException): ErrorBody {
    return error.getResponse() as ErrorBody;
  }

  private serialize(status: number, body: ErrorBody): string | Record<string, unknown> {
    if (typeof body === 'string') return { statusCode: status, message: body };
    return body.statusCode === undefined ? { statusCode: status, ...body } : body;
  }
}
