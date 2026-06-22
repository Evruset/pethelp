import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { config } from '../config';
import { BookingService } from '../booking-core/booking.service';

@Injectable()
export class HoldExpirationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HoldExpirationService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly booking: BookingService) {}

  onModuleInit(): void {
    if (!config.workersEnabled) return;
    this.timer = setInterval(() => void this.runOnce(), 15_000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async runOnce(): Promise<{ expired: number }> {
    if (this.running) return { expired: 0 };
    this.running = true;
    try {
      const result = await this.booking.expireHolds();
      if (result.expired > 0) this.logger.log(`Expired ${result.expired} hold(s)`);
      return result;
    } finally {
      this.running = false;
    }
  }
}
