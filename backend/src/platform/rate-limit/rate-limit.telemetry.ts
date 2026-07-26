import { Injectable } from '@nestjs/common';

export type SharedRateLimitTelemetrySnapshot = Readonly<{
  consumeAllowed: number;
  consumeDenied: number;
  consumeDatabaseFailures: number;
  cleanupDeletedRows: number;
  cleanupFailures: number;
  cleanupSaturatedRuns: number;
  cleanupLastDurationMs: number;
  cleanupLastSuccessAt: string | null;
  oldestExpiredAgeBucket: 'NONE' | 'UNDER_24H' | 'OVER_24H';
}>;

@Injectable()
export class SharedRateLimitTelemetry {
  private consumeAllowed = 0;
  private consumeDenied = 0;
  private consumeDatabaseFailures = 0;
  private cleanupDeletedRows = 0;
  private cleanupFailures = 0;
  private cleanupSaturatedRuns = 0;
  private cleanupLastDurationMs = 0;
  private cleanupLastSuccessAt: string | null = null;
  private oldestExpiredAgeBucket: SharedRateLimitTelemetrySnapshot['oldestExpiredAgeBucket'] = 'NONE';

  recordConsume(allowed: boolean): void {
    if (allowed) this.consumeAllowed += 1;
    else this.consumeDenied += 1;
  }

  recordConsumeDatabaseFailure(): void {
    this.consumeDatabaseFailures += 1;
  }

  recordCleanupSuccess(input: { deletedRows: number; durationMs: number; oldestExpiredAgeSeconds: number | null }): void {
    this.cleanupDeletedRows += input.deletedRows;
    this.cleanupLastDurationMs = input.durationMs;
    this.cleanupLastSuccessAt = new Date().toISOString();
    this.oldestExpiredAgeBucket = input.oldestExpiredAgeSeconds === null
      ? 'NONE'
      : input.oldestExpiredAgeSeconds > 86_400 ? 'OVER_24H' : 'UNDER_24H';
  }

  recordCleanupFailure(): void {
    this.cleanupFailures += 1;
  }

  recordCleanupSaturated(): void {
    this.cleanupSaturatedRuns += 1;
  }

  snapshot(): SharedRateLimitTelemetrySnapshot {
    return Object.freeze({
      consumeAllowed: this.consumeAllowed,
      consumeDenied: this.consumeDenied,
      consumeDatabaseFailures: this.consumeDatabaseFailures,
      cleanupDeletedRows: this.cleanupDeletedRows,
      cleanupFailures: this.cleanupFailures,
      cleanupSaturatedRuns: this.cleanupSaturatedRuns,
      cleanupLastDurationMs: this.cleanupLastDurationMs,
      cleanupLastSuccessAt: this.cleanupLastSuccessAt,
      oldestExpiredAgeBucket: this.oldestExpiredAgeBucket,
    });
  }
}
