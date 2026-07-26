import { MAX_LOGICAL_RATE_LIMIT_TTL_SECONDS } from './rate-limit.types';

export type SharedRateLimitConfig = Readonly<{
  logicalStateRetentionSeconds: number;
  physicalCleanupTargetSeconds: number;
  cleanupIntervalSeconds: number;
  cleanupBatchSize: number;
  cleanupMaxBatchesPerRun: number;
}>;

function positiveInteger(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

export function loadSharedRateLimitConfig(env: NodeJS.ProcessEnv = process.env): SharedRateLimitConfig {
  const logicalStateRetentionSeconds = positiveInteger(
    env,
    'VETHELP_SHARED_RATE_LIMIT_LOGICAL_TTL_SECONDS',
    MAX_LOGICAL_RATE_LIMIT_TTL_SECONDS,
  );
  const physicalCleanupTargetSeconds = positiveInteger(
    env,
    'VETHELP_SHARED_RATE_LIMIT_PHYSICAL_CLEANUP_TARGET_SECONDS',
    86_400,
  );
  const cleanupIntervalSeconds = positiveInteger(
    env,
    'VETHELP_SHARED_RATE_LIMIT_CLEANUP_INTERVAL_SECONDS',
    900,
  );
  const cleanupBatchSize = positiveInteger(
    env,
    'VETHELP_SHARED_RATE_LIMIT_CLEANUP_BATCH_SIZE',
    1_000,
  );
  const cleanupMaxBatchesPerRun = positiveInteger(
    env,
    'VETHELP_SHARED_RATE_LIMIT_CLEANUP_MAX_BATCHES_PER_RUN',
    10,
  );

  if (
    logicalStateRetentionSeconds > MAX_LOGICAL_RATE_LIMIT_TTL_SECONDS
    || physicalCleanupTargetSeconds < logicalStateRetentionSeconds
    || physicalCleanupTargetSeconds > 86_400
    || cleanupBatchSize > 1_000
    || cleanupMaxBatchesPerRun > 10
  ) {
    throw new Error('Shared rate limit configuration violates the retention contract');
  }

  return Object.freeze({
    logicalStateRetentionSeconds,
    physicalCleanupTargetSeconds,
    cleanupIntervalSeconds,
    cleanupBatchSize,
    cleanupMaxBatchesPerRun,
  });
}
