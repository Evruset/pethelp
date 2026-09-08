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
  private lastSuccessAt: string | null = null;
  private processedTotal = 0;
  private failuresTotal = 0;
  private backlog = {
    pendingCount: null as number | null,
    overdueCount: null as number | null,
    oldestOverdueAgeSeconds: null as number | null,
  };

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
      this.lastSuccessAt = new Date().toISOString();
      this.processedTotal += result.expired;
      try {
        this.backlog = await this.booking.expirationBacklog();
      } catch {
        this.failuresTotal += 1;
        this.logger.error('Hold expiration backlog refresh failed; cached health remains available');
      }
      if (result.expired > 0) this.logger.log(`Expired ${result.expired} hold(s)`);
      return result;
    } catch (error) {
      this.failuresTotal += 1;
      throw error;
    } finally {
      if (this.inFlight === run) this.inFlight = undefined;
      this.running = false;
    }
  }

  healthSnapshot(): {
    running: boolean;
    lastSuccessAt: string | null;
    processedTotal: number;
    failuresTotal: number;
    pendingCount: number | null;
    overdueCount: number | null;
    oldestOverdueAgeSeconds: number | null;
  } {
    return {
      running: this.running,
      lastSuccessAt: this.lastSuccessAt,
      processedTotal: this.processedTotal,
      failuresTotal: this.failuresTotal,
      ...this.backlog,
    };
  }

  private scheduleRun(): void {
    void this.runOnce().catch((error: unknown) => {
      this.logger.error('Hold expiration cycle failed; the next scheduled cycle will retry');
    });
  }
}
