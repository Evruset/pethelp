export interface AppConfig {
  readonly port: number;
  readonly databaseUrl: string;
  readonly holdTtlMinutes: number;
  readonly workersEnabled: boolean;
  readonly outboxPollIntervalMs: number;
  readonly outboxBatchSize: number;
  readonly jwtSecret: string;
  readonly jwtIssuer: string;
  readonly jwtAudience: string;
  readonly workerServiceToken: string;
  readonly misVetManagerBaseUrl?: string;
  readonly misVetManagerApiKey?: string;
}

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} must be configured`);
  return value;
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export const config: AppConfig = Object.freeze({
  port: intEnv('PORT', 3000),
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://vethelp:vethelp@localhost:5432/vethelp',
  holdTtlMinutes: intEnv('HOLD_TTL_MINUTES', 10),
  workersEnabled: (process.env.WORKERS_ENABLED ?? 'true').toLowerCase() === 'true',
  outboxPollIntervalMs: intEnv('OUTBOX_POLL_INTERVAL_MS', 3000),
  outboxBatchSize: intEnv('OUTBOX_BATCH_SIZE', 20),
  jwtSecret: requiredEnv('JWT_SECRET'),
  jwtIssuer: requiredEnv('JWT_ISSUER'),
  jwtAudience: requiredEnv('JWT_AUDIENCE'),
  workerServiceToken: requiredEnv('WORKER_SERVICE_TOKEN'),
  misVetManagerBaseUrl: optionalEnv('MIS_VET_MANAGER_BASE_URL'),
  misVetManagerApiKey: optionalEnv('MIS_VET_MANAGER_API_KEY'),
});
