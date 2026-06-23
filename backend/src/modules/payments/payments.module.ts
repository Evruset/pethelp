import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { AcquiringClient } from './acquiring-client.service';
import { AcquiringWebhookVerifier } from './acquiring-webhook-verifier';
import { PaymentController } from './payment.controller';
import { PaymentOutboxRelayWorker } from './payment-outbox-relay.worker';
import { PaymentReconciliationWorker } from './payment-reconciliation.worker';
import { PaymentRefundService } from './payment-refund.service';
import { PaymentService } from './payment.service';
import { PaymentWebhookService } from './payment-webhook.service';

@Module({
  imports: [HttpModule.register({ maxRedirects: 0 })],
  controllers: [PaymentController],
  providers: [
    AcquiringClient,
    AcquiringWebhookVerifier,
    PaymentService,
    PaymentRefundService,
    PaymentWebhookService,
    PaymentOutboxRelayWorker,
    PaymentReconciliationWorker,
  ],
  exports: [PaymentService, PaymentRefundService, PaymentWebhookService],
})
export class PaymentsModule {}
