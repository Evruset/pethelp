import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { ObservabilityMetricsService } from './observability.metrics';

@Injectable()
export class ApiMetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: ObservabilityMetricsService) {}

  use(_request: Request, response: Response, next: NextFunction): void {
    const startedAt = process.hrtime.bigint();
    response.once('finish', () => {
      const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      this.metrics.recordApiRequest(elapsedMs, response.statusCode);
    });
    next();
  }
}
