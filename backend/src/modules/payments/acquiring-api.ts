import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AcquiringApi {
  private readonly logger = new Logger(AcquiringApi.name);

  /**
   * Boundary for provider void/refund call. Intentionally invoked after the
   * database transaction commits so provider latency never holds DB locks.
   */
  async void(paymentId: string): Promise<void> {
    this.logger.warn(`Acquiring void requested for payment intent ${paymentId}`);
  }
}
