export const MAX_LOGICAL_RATE_LIMIT_TTL_SECONDS = 3_900;

export type RateLimitPolicy = Readonly<{
  windowSeconds: number;
  limit: number;
}>;

export type ConsumeRateLimitInput = Readonly<{
  namespace: string;
  actorId: string;
  clinicId: string;
  locationId: string;
  policies: ReadonlyArray<RateLimitPolicy>;
  logicalStateRetentionSeconds?: number;
}>;

export type RateLimitPolicyResult = Readonly<{
  windowSeconds: number;
  limit: number;
  currentCount: number;
  remaining: number;
  resetsAt: string;
}>;

export type ConsumeRateLimitResult = Readonly<{
  allowed: boolean;
  evaluatedAt: string;
  retryAfterSeconds: number | null;
  policies: ReadonlyArray<RateLimitPolicyResult>;
}>;

export class InvalidRateLimitPolicyError extends Error {
  readonly code = 'SHARED_RATE_LIMIT_POLICY_INVALID';

  constructor() {
    super('Shared rate limit policy is invalid');
    this.name = 'InvalidRateLimitPolicyError';
  }
}

export class SharedRateLimiterUnavailableError extends Error {
  readonly code = 'SHARED_RATE_LIMIT_UNAVAILABLE';

  constructor(options?: ErrorOptions) {
    super('Shared rate limiter is unavailable', options);
    this.name = 'SharedRateLimiterUnavailableError';
  }
}
