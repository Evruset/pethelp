import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { loadSharedRateLimitConfig } from './rate-limit.config';
import { RateLimitDatabaseService } from './rate-limit-database.service';
import { SharedRateLimitTelemetry } from './rate-limit.telemetry';
import {
  ConsumeRateLimitInput,
  ConsumeRateLimitResult,
  InvalidRateLimitPolicyError,
  MAX_LOGICAL_RATE_LIMIT_TTL_SECONDS,
  RateLimitPolicy,
  SharedRateLimiterUnavailableError,
} from './rate-limit.types';

type ConsumeRow = {
  evaluated_at: Date;
  retry_after_seconds: number | null;
  window_seconds: number;
  policy_limit: number;
  hit_count: number;
  remaining: number;
  window_ends_at: Date;
};

type CleanupRow = {
  deleted_count: number;
  oldest_expired_age_seconds: number | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NAMESPACE = /^[a-z][a-z0-9._-]{0,63}$/;

@Injectable()
export class PostgresRateLimitService {
  constructor(
    private readonly database: RateLimitDatabaseService,
    private readonly telemetry: SharedRateLimitTelemetry,
  ) {}

  async consume(input: ConsumeRateLimitInput): Promise<ConsumeRateLimitResult> {
    const policies = this.validate(input);
    const logicalRetention = input.logicalStateRetentionSeconds
      ?? loadSharedRateLimitConfig().logicalStateRetentionSeconds;

    try {
      const rows = await this.database.withTransaction((client) =>
        this.consumeInTransaction(client, input, policies, logicalRetention));
      const first = rows[0];
      const allowed = rows.every((row) => row.hit_count <= row.policy_limit);
      this.telemetry.recordConsume(allowed);
      return Object.freeze({
        allowed,
        evaluatedAt: first.evaluated_at.toISOString(),
        retryAfterSeconds: first.retry_after_seconds,
        policies: Object.freeze(rows.map((row) => Object.freeze({
          windowSeconds: row.window_seconds,
          limit: row.policy_limit,
          currentCount: row.hit_count,
          remaining: row.remaining,
          resetsAt: row.window_ends_at.toISOString(),
        }))),
      });
    } catch (error) {
      if (error instanceof InvalidRateLimitPolicyError) throw error;
      this.telemetry.recordConsumeDatabaseFailure();
      throw new SharedRateLimiterUnavailableError({ cause: error });
    }
  }

  async cleanupExpired(batchSize = loadSharedRateLimitConfig().cleanupBatchSize): Promise<{
    deletedRows: number;
    oldestExpiredAgeSeconds: number | null;
  }> {
    if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1_000) {
      throw new InvalidRateLimitPolicyError();
    }

    const result = await this.database.withTransaction(async (client) => {
      await client.query("SET LOCAL lock_timeout = '250ms'");
      await client.query("SET LOCAL statement_timeout = '2s'");
      return client.query<CleanupRow>(`
        WITH db_time AS MATERIALIZED (
          SELECT clock_timestamp() AS evaluated_at
        ), candidates AS MATERIALIZED (
          SELECT windows.id
          FROM public.shared_rate_limit_windows windows, db_time
          WHERE windows.expires_at <= db_time.evaluated_at
          ORDER BY windows.expires_at, windows.id
          FOR UPDATE OF windows SKIP LOCKED
          LIMIT $1
        ), deleted AS (
          DELETE FROM public.shared_rate_limit_windows windows
          USING candidates
          WHERE windows.id = candidates.id
          RETURNING windows.id
        )
        SELECT
          COUNT(deleted.id)::integer AS deleted_count,
          (
            SELECT EXTRACT(EPOCH FROM (
              MAX(db_time.evaluated_at) - MIN(windows.expires_at)
            ))::double precision
            FROM public.shared_rate_limit_windows windows, db_time
            WHERE windows.expires_at <= db_time.evaluated_at
          ) AS oldest_expired_age_seconds
        FROM deleted
      `, [batchSize]);
    });

    return {
      deletedRows: result.rows[0].deleted_count,
      oldestExpiredAgeSeconds: result.rows[0].oldest_expired_age_seconds,
    };
  }

  private async consumeInTransaction(
    client: PoolClient,
    input: ConsumeRateLimitInput,
    policies: ReadonlyArray<RateLimitPolicy>,
    logicalRetentionSeconds: number,
  ): Promise<ConsumeRow[]> {
    await client.query("SET LOCAL lock_timeout = '2s'");
    await client.query("SET LOCAL statement_timeout = '3s'");
    const result = await client.query<ConsumeRow>(`
      WITH db_time AS MATERIALIZED (
        SELECT clock_timestamp() AS evaluated_at
      ), requested_policy AS MATERIALIZED (
        SELECT window_seconds, policy_limit
        FROM unnest($5::integer[], $6::integer[]) AS policy(window_seconds, policy_limit)
        ORDER BY window_seconds
      ), active_windows AS MATERIALIZED (
        SELECT
          policy.window_seconds,
          policy.policy_limit,
          to_timestamp(
            floor(EXTRACT(EPOCH FROM db_time.evaluated_at) / policy.window_seconds)
            * policy.window_seconds
          ) AS window_started_at,
          db_time.evaluated_at
        FROM requested_policy policy
        CROSS JOIN db_time
      ), consumed AS (
        INSERT INTO public.shared_rate_limit_windows (
          namespace,
          actor_id,
          clinic_id,
          location_id,
          window_seconds,
          window_started_at,
          window_ends_at,
          expires_at,
          hit_count,
          created_at,
          updated_at
        )
        SELECT
          $1,
          $2::uuid,
          $3::uuid,
          $4::uuid,
          window_seconds,
          window_started_at,
          window_started_at + make_interval(secs => window_seconds),
          window_started_at + make_interval(secs => $7),
          1,
          evaluated_at,
          evaluated_at
        FROM active_windows
        ORDER BY window_seconds
        ON CONFLICT (
          namespace,
          actor_id,
          clinic_id,
          location_id,
          window_seconds,
          window_started_at
        ) DO UPDATE
        SET hit_count = shared_rate_limit_windows.hit_count + 1,
            updated_at = EXCLUDED.updated_at
        RETURNING window_seconds, hit_count, window_ends_at
      ), evaluated AS MATERIALIZED (
        SELECT
          db_time.evaluated_at,
          consumed.window_seconds,
          requested_policy.policy_limit,
          consumed.hit_count,
          GREATEST(requested_policy.policy_limit - consumed.hit_count, 0)::integer AS remaining,
          consumed.window_ends_at
        FROM consumed
        JOIN requested_policy USING (window_seconds)
        CROSS JOIN db_time
      ), decision AS (
        SELECT CASE
          WHEN BOOL_AND(hit_count <= policy_limit) THEN NULL
          ELSE GREATEST(
            1,
            CEIL(MAX(EXTRACT(EPOCH FROM (window_ends_at - evaluated_at)))
              FILTER (WHERE hit_count >= policy_limit))
          )::integer
        END AS retry_after_seconds
        FROM evaluated
      )
      SELECT evaluated.*, decision.retry_after_seconds
      FROM evaluated
      CROSS JOIN decision
      ORDER BY evaluated.window_seconds
    `, [
      input.namespace,
      input.actorId,
      input.clinicId,
      input.locationId,
      policies.map((policy) => policy.windowSeconds),
      policies.map((policy) => policy.limit),
      logicalRetentionSeconds,
    ]);
    return result.rows;
  }

  private validate(input: ConsumeRateLimitInput): ReadonlyArray<RateLimitPolicy> {
    const logicalRetention = input.logicalStateRetentionSeconds
      ?? loadSharedRateLimitConfig().logicalStateRetentionSeconds;
    if (
      !NAMESPACE.test(input.namespace)
      || !UUID.test(input.actorId)
      || !UUID.test(input.clinicId)
      || !UUID.test(input.locationId)
      || !Number.isInteger(logicalRetention)
      || logicalRetention < 1
      || logicalRetention > MAX_LOGICAL_RATE_LIMIT_TTL_SECONDS
      || input.policies.length < 1
      || input.policies.length > 4
    ) {
      throw new InvalidRateLimitPolicyError();
    }

    const policies = [...input.policies].sort((left, right) => left.windowSeconds - right.windowSeconds);
    const windows = new Set<number>();
    for (const policy of policies) {
      if (
        !Number.isInteger(policy.windowSeconds)
        || policy.windowSeconds < 1
        || policy.windowSeconds > 3_600
        || !Number.isInteger(policy.limit)
        || policy.limit < 1
        || windows.has(policy.windowSeconds)
      ) {
        throw new InvalidRateLimitPolicyError();
      }
      windows.add(policy.windowSeconds);
    }
    if (logicalRetention < policies.at(-1)!.windowSeconds) {
      throw new InvalidRateLimitPolicyError();
    }
    return Object.freeze(policies.map((policy) => Object.freeze({ ...policy })));
  }
}
