import { Injectable } from '@nestjs/common';
import { ContextLoggerService } from './context-logger.service';

export type AlertType =
  | 'MIS_INTEGRATION_TIMEOUT'
  | 'PAYMENT_FENCING_TRIGGERED'
  | 'SLA_AUTO_VOID_FAILED'
  | 'REFUND_FAILED';

@Injectable()
export class ObservabilityMetricsService {
  constructor(private readonly logger: ContextLoggerService) {}

  critical(alertType: AlertType, context: string, message: string, fields: Record<string, unknown> = {}): void {
    this.logger.event('error', context, message, {
      metric: 'vethelp_business_failure_total',
      alert_type: alertType,
      ...fields,
    });
  }
}
