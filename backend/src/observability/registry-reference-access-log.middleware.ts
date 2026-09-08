import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { ContextLoggerService } from './context-logger.service';
import { RegistryReferenceTelemetry } from './registry-reference-telemetry';

const REGISTRY_PATH =
  /^\/v1\/clinic\/[^/]+\/locations\/[^/]+\/patients$/;
const REFERENCE_KEY = /(?:^|&)administrativeReference(?:=|&|$)/;
export const REGISTRY_REFERENCE_ROUTE =
  '/v1/clinic/:clinicId/locations/:locationId/patients';

export function sanitizeRegistryReferenceAccessUrl(rawUrl: string): string | null {
  const queryStart = rawUrl.indexOf('?');
  if (queryStart < 0) return null;
  const path = rawUrl.slice(0, queryStart);
  if (!REGISTRY_PATH.test(path)) return null;
  const fragmentStart = rawUrl.indexOf('#', queryStart);
  const query = rawUrl.slice(queryStart + 1, fragmentStart < 0 ? undefined : fragmentStart);
  if (!REFERENCE_KEY.test(query)) return null;
  return `${REGISTRY_REFERENCE_ROUTE}?administrativeReference=[REDACTED]`;
}

@Injectable()
export class RegistryReferenceAccessLogMiddleware implements NestMiddleware {
  constructor(
    private readonly logger: ContextLoggerService,
    private readonly telemetry: RegistryReferenceTelemetry,
  ) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const route = sanitizeRegistryReferenceAccessUrl(request.originalUrl);
    if (!route) {
      next();
      return;
    }
    const startedAt = process.hrtime.bigint();
    response.once('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      this.logger.event('log', 'RegistryReferenceAccess', 'http.request.completed', {
        method: request.method,
        route,
        status_code: response.statusCode,
        duration_ms: Number(durationMs.toFixed(3)),
      });
      if (response.statusCode === 401 || response.statusCode === 403) {
        this.telemetry.record({
          outcome: 'AUTH_DENIED',
          featureState: 'ENABLED',
          durationMs,
        });
      }
    });
    next();
  }
}
