import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { AcquiringApi } from './acquiring-api';
import { AcquiringWebhookVerifier } from './acquiring-webhook-verifier';
import { PaymentController } from './payment.controller';
import { PaymentOutboxRelayWorker } from './payment-outbox-relay.worker';
import { PaymentReconciliationWorker } from './payment-reconciliation.worker';
import { PaymentService } from './payment.service';

@Module({
  imports: [HttpModule.register({ maxRedirects: 0 })],
  controllers: [PaymentController],
  providers: [
    AcquiringApi,
    AcquiringWebhookVerifier,
    PaymentService,
    PaymentOutboxRelayWorker,
    PaymentReconciliationWorker,
  ],
  exports: [PaymentService],
})
export class PaymentsModule {}
