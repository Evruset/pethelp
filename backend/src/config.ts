export interface AppConfig {
  readonly port: number;
  readonly databaseUrl: string;
  readonly holdTtlMinutes: number;
  readonly workersEnabled: boolean;
  readonly outboxPollIntervalMs: number;
  readonly outboxBatchSize: number;
  readonly devWorkerKey: string;
}

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
}

export const config: AppConfig = Object.freeze({
  port: intEnv('PORT', 3000),
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://vethelp:vethelp@localhost:5432/vethelp',
  holdTtlMinutes: intEnv('HOLD_TTL_MINUTES', 10),
  workersEnabled: (process.env.WORKERS_ENABLED ?? 'true').toLowerCase() === 'true',
  outboxPollIntervalMs: intEnv('OUTBOX_POLL_INTERVAL_MS', 3000),
  outboxBatchSize: intEnv('OUTBOX_BATCH_SIZE', 20),
  devWorkerKey: process.env.DEV_WORKER_KEY ?? 'change-me-before-public-use',
});
