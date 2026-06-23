import type { Request } from 'express';
import { TraceContext } from '../observability/trace-context.context';
import { CORRELATION_ID_HEADER, TraceMiddleware } from '../observability/trace.middleware';

export { CORRELATION_ID_HEADER };
export { TraceMiddleware as CorrelationIdMiddleware };

/** @deprecated Inject TraceContext or rely on TraceMiddleware instead. */
export function correlationIdFromRequest(request: Request): string {
  return new TraceContext().correlationIdFromHeader(request.headers[CORRELATION_ID_HEADER]);
}
