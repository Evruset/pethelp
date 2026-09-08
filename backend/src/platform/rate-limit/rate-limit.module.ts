import { Module } from '@nestjs/common';
import { PostgresRateLimitService } from './postgres-rate-limit.service';
import { RateLimitCleanupWorker } from './rate-limit-cleanup.worker';
import { SharedRateLimitTelemetry } from './rate-limit.telemetry';
import { RateLimitDatabaseService } from './rate-limit-database.service';

@Module({
  providers: [
    PostgresRateLimitService,
    RateLimitDatabaseService,
    SharedRateLimitTelemetry,
    RateLimitCleanupWorker,
  ],
  exports: [PostgresRateLimitService, SharedRateLimitTelemetry],
})
export class RateLimitModule {}
