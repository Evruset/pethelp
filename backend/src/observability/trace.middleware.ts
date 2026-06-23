import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { TraceContext } from './trace-context.context';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

@Injectable()
export class TraceMiddleware implements NestMiddleware {
  constructor(private readonly traceContext: TraceContext) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const correlationId = this.traceContext.correlationIdFromHeader(request.headers[CORRELATION_ID_HEADER]);
    request.headers[CORRELATION_ID_HEADER] = correlationId;
    response.setHeader('X-Correlation-ID', correlationId);

    this.traceContext.run({ correlationId }, () => next());
  }
}
