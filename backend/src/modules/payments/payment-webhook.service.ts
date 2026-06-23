import { Injectable } from '@nestjs/common';
import { DomainException } from '../../common/domain-error';
import { ObservabilityMetricsService } from '../../observability/observability.metrics';
import { PaymentAuthorizedWebhookCommand, PaymentIntentResult, PaymentService } from './payment.service';

@Injectable()
export class PaymentWebhookService {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly metrics: ObservabilityMetricsService,
  ) {}

  async handleAuthorized(command: PaymentAuthorizedWebhookCommand): Promise<PaymentIntentResult> {
    try {
      return await this.paymentService.handlePaymentAuthorized(command);
    } catch (error) {
      if (error instanceof DomainException) {
        const response = error.getResponse() as { code?: string; message?: string };
        if (response.code?.startsWith('PAYMENT_FENCED_')) {
          this.metrics.critical('PAYMENT_FENCING_TRIGGERED', PaymentWebhookService.name, 'Payment fence rejected provider authorization', {
            paymentWebhookEventId: command.providerEventId,
            idempotencyKey: command.idempotencyKey,
            fenceCode: response.code,
          });
        }
      }
      throw error;
    }
  }
}
