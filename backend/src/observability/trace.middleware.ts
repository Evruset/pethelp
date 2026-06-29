import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { TraceContext } from './trace-context.context';

export const CORRELATION_ID_HEADER = 'x-correlation-id';
export const CAUSATION_ID_HEADER = 'x-causation-id';
export const TRACEPARENT_HEADER = 'traceparent';
const FORWARDED_FOR_HEADER = 'x-forwarded-for';
const USER_AGENT_HEADER = 'user-agent';

@Injectable()
export class TraceMiddleware implements NestMiddleware {
  constructor(private readonly traceContext: TraceContext) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const correlationId = this.traceContext.correlationIdFromHeader(request.headers[CORRELATION_ID_HEADER]);
    const causationId = this.traceContext.causationIdFromHeader(request.headers[CAUSATION_ID_HEADER]);
    const traceparent = this.traceContext.traceparentFromHeader(request.headers[TRACEPARENT_HEADER]);
    const actorIp = this.traceContext.actorIpFromRequest(request.ip, request.headers[FORWARDED_FOR_HEADER]);
    const userAgent = this.traceContext.userAgentFromHeader(request.headers[USER_AGENT_HEADER]);
    request.headers[CORRELATION_ID_HEADER] = correlationId;
    response.setHeader('X-Correlation-ID', correlationId);

    this.traceContext.run({ correlationId, causationId, traceparent, actorIp, userAgent }, () => next());
  }
}
