import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { config } from '../config';
import { BookingService } from '../booking-core/booking.service';

@Injectable()
export class HoldExpirationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HoldExpirationService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private inFlight?: Promise<{ expired: number }>;
  private stopping = false;

  constructor(private readonly booking: BookingService) {}

  onModuleInit(): void {
    if (!config.workersEnabled || this.timer) return;
    this.timer = setInterval(() => this.scheduleRun(), 15_000);
    this.timer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    await this.inFlight?.catch(() => undefined);
  }

  async runOnce(): Promise<{ expired: number }> {
    if (this.running || this.stopping) return { expired: 0 };
    this.running = true;
    const run = Promise.resolve().then(() => this.booking.expireHolds());
    this.inFlight = run;
    try {
      const result = await run;
      if (result.expired > 0) this.logger.log(`Expired ${result.expired} hold(s)`);
      return result;
    } finally {
      if (this.inFlight === run) this.inFlight = undefined;
      this.running = false;
    }
  }

  private scheduleRun(): void {
    void this.runOnce().catch((error: unknown) => {
      const detail = error instanceof Error ? error.stack : String(error);
      this.logger.error('Hold expiration cycle failed; the next scheduled cycle will retry', detail);
    });
  }
}
