import { Module } from '@nestjs/common';
import { AcquiringApi } from './acquiring-api';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

@Module({
  controllers: [PaymentController],
  providers: [AcquiringApi, PaymentService],
  exports: [PaymentService],
})
export class PaymentsModule {}
