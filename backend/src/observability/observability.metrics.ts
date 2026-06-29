import { Injectable } from '@nestjs/common';
import { ContextLoggerService } from './context-logger.service';

export type AlertType =
  | 'MIS_INTEGRATION_TIMEOUT'
  | 'PAYMENT_FENCING_TRIGGERED'
  | 'SLA_AUTO_VOID_FAILED'
  | 'REFUND_FAILED'
  | 'CLINIC_SLA_BREACHED';

@Injectable()
export class ObservabilityMetricsService {
  private readonly apiSamples: Array<{ at: number; durationMs: number; statusCode: number }> = [];
  private readonly windowMs = 5 * 60 * 1000;

  constructor(private readonly logger: ContextLoggerService) {}

  critical(alertType: AlertType, context: string, message: string, fields: Record<string, unknown> = {}): void {
    this.logger.event('error', context, message, {
      metric: 'vethelp_business_failure_total',
      alert_type: alertType,
      ...fields,
    });
  }

  recordApiRequest(durationMs: number, statusCode: number): void {
    const now = Date.now();
    this.apiSamples.push({ at: now, durationMs, statusCode });
    this.prune(now);
  }

  apiSnapshot(): { latencyP95Ms: number; errorRate: number; samples: number } {
    const now = Date.now();
    this.prune(now);
    if (this.apiSamples.length === 0) return { latencyP95Ms: 0, errorRate: 0, samples: 0 };

    const sorted = this.apiSamples.map((sample) => sample.durationMs).sort((left, right) => left - right);
    const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
    const errors = this.apiSamples.filter((sample) => sample.statusCode >= 500).length;
    return {
      latencyP95Ms: Number(sorted[index].toFixed(3)),
      errorRate: Number((errors / this.apiSamples.length).toFixed(6)),
      samples: this.apiSamples.length,
    };
  }

  private prune(now: number): void {
    const cutoff = now - this.windowMs;
    while (this.apiSamples[0]?.at < cutoff) {
      this.apiSamples.shift();
    }
  }
}
