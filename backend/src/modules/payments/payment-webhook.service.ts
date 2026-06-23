import { Injectable } from '@nestjs/common';
import { PaymentAuthorizedWebhookCommand, PaymentIntentResult, PaymentService } from './payment.service';

@Injectable()
export class PaymentWebhookService {
  constructor(private readonly paymentService: PaymentService) {}

  async handleAuthorized(command: PaymentAuthorizedWebhookCommand): Promise<PaymentIntentResult> {
    return this.paymentService.handlePaymentAuthorized(command);
  }
}
