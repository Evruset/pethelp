import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

export function correlationIdFromRequest(request: Request): string {
  const value = request.header(CORRELATION_ID_HEADER);
  return value && value.length <= 128 ? value : randomUUID();
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const correlationId = correlationIdFromRequest(request);
    request.headers[CORRELATION_ID_HEADER] = correlationId;
    response.setHeader('X-Correlation-ID', correlationId);
    next();
  }
}
