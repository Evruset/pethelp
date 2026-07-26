import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { config } from '../../config';
import { loadSharedRateLimitConfig } from './rate-limit.config';
import { PostgresRateLimitService } from './postgres-rate-limit.service';
import { SharedRateLimitTelemetry } from './rate-limit.telemetry';

@Injectable()
export class RateLimitCleanupWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RateLimitCleanupWorker.name);
  private readonly workerConfig = loadSharedRateLimitConfig();
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;

  constructor(
    private readonly limiter: PostgresRateLimitService,
    private readonly telemetry: SharedRateLimitTelemetry,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!config.workersEnabled) return;
    await this.startRun();
    this.timer = setInterval(
      () => void this.startRun(),
      this.workerConfig.cleanupIntervalSeconds * 1_000,
    );
    this.timer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }

  async runOnce(): Promise<void> {
    await this.startRun();
  }

  private startRun(): Promise<void> {
    if (this.running) return this.running;
    const started = performance.now();
    this.running = this.cleanupBatches()
      .then((result) => {
        const durationMs = performance.now() - started;
        this.telemetry.recordCleanupSuccess({
          deletedRows: result.deletedRows,
          oldestExpiredAgeSeconds: result.oldestExpiredAgeSeconds,
          durationMs,
        });
        if (result.saturated) {
          this.telemetry.recordCleanupSaturated();
          this.logger.warn('Shared rate-limit cleanup reached the bounded catch-up limit');
        }
        if (
          result.oldestExpiredAgeSeconds !== null
          && result.oldestExpiredAgeSeconds > this.workerConfig.physicalCleanupTargetSeconds
        ) {
          this.logger.warn('Shared rate-limit cleanup backlog exceeds the physical retention target');
        }
      })
      .catch(() => {
        this.telemetry.recordCleanupFailure();
        this.logger.error('Shared rate-limit cleanup failed');
      })
      .finally(() => {
        this.running = undefined;
      });
    return this.running;
  }

  private async cleanupBatches(): Promise<{
    deletedRows: number;
    oldestExpiredAgeSeconds: number | null;
    saturated: boolean;
  }> {
    let deletedRows = 0;
    let oldestExpiredAgeSeconds: number | null = null;
    for (let batch = 0; batch < this.workerConfig.cleanupMaxBatchesPerRun; batch += 1) {
      const result = await this.limiter.cleanupExpired(this.workerConfig.cleanupBatchSize);
      deletedRows += result.deletedRows;
      oldestExpiredAgeSeconds = result.oldestExpiredAgeSeconds;
      if (result.deletedRows < this.workerConfig.cleanupBatchSize) {
        return { deletedRows, oldestExpiredAgeSeconds, saturated: false };
      }
    }
    return { deletedRows, oldestExpiredAgeSeconds, saturated: true };
  }
}
