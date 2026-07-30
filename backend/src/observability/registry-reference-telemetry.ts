import { Injectable } from '@nestjs/common';
import { Role } from '../auth/auth.types';
import { ContextLoggerService } from './context-logger.service';

export const REGISTRY_REFERENCE_OUTCOMES = [
  'FOUND',
  'EMPTY',
  'VALIDATION_REJECTED',
  'INVALID_COMBINATION',
  'AUTH_DENIED',
  'SCOPE_UNAVAILABLE',
  'POLICY_UNAVAILABLE',
  'RATE_LIMITED',
  'TECHNICAL_ERROR',
  'INVARIANT_VIOLATION',
  'FLAG_DISABLED',
] as const;

export type RegistryReferenceOutcome = typeof REGISTRY_REFERENCE_OUTCOMES[number];
export type RegistryReferenceRoleClass = 'RECEPTION' | 'ADMIN' | 'UNKNOWN';
export type RegistryReferenceFeatureState = 'ENABLED' | 'DISABLED';
export type RegistryReferenceQueryLengthBucket = 'EMPTY' | 'SHORT' | 'MEDIUM' | 'LONG' | 'OVERSIZED';

export type RegistryReferenceTelemetrySample = Readonly<{
  outcome: RegistryReferenceOutcome;
  roleClass: RegistryReferenceRoleClass;
  featureState: RegistryReferenceFeatureState;
  resultCount: 0 | 1;
  queryLengthBucket: RegistryReferenceQueryLengthBucket;
  durationMs: number;
}>;

export type RegistryReferenceAlertDefinition = Readonly<{
  id: string;
  signal: string;
  windowMinutes: number;
  severity: 'critical' | 'high' | 'medium' | 'release-blocking';
  minimumRequests: number;
  threshold: number;
  runbookAnchor: string;
  payloadFields: readonly string[];
}>;

const SAFE_OPERATIONAL_FIELDS = new Set([
  'outcome',
  'duration_ms',
  'result_count',
  'feature_state',
  'query_length_bucket',
  'role_class',
]);

export const REGISTRY_REFERENCE_ALERTS: readonly RegistryReferenceAlertDefinition[] = Object.freeze([
  {
    id: 'registry-reference-invariant',
    signal: 'invariant_violation_count',
    windowMinutes: 5,
    severity: 'critical',
    minimumRequests: 0,
    threshold: 0,
    runbookAnchor: 'invariant-violation',
    payloadFields: ['outcome'],
  },
  {
    id: 'registry-reference-technical-error-ratio',
    signal: 'technical_error_ratio',
    windowMinutes: 10,
    severity: 'high',
    minimumRequests: 100,
    threshold: 0.05,
    runbookAnchor: 'technical-errors',
    payloadFields: ['outcome'],
  },
  {
    id: 'registry-reference-policy-unavailable-ratio',
    signal: 'policy_unavailable_ratio',
    windowMinutes: 10,
    severity: 'high',
    minimumRequests: 50,
    threshold: 0.01,
    runbookAnchor: 'policy-unavailable',
    payloadFields: ['outcome'],
  },
  {
    id: 'registry-reference-rate-limit-ratio',
    signal: 'rate_limited_ratio',
    windowMinutes: 15,
    severity: 'medium',
    minimumRequests: 100,
    threshold: 0.10,
    runbookAnchor: 'frequent-429',
    payloadFields: ['outcome'],
  },
  {
    id: 'registry-reference-empty-anomaly',
    signal: 'empty_ratio_baseline_delta',
    windowMinutes: 30,
    severity: 'medium',
    minimumRequests: 200,
    threshold: 0.30,
    runbookAnchor: 'all-searches-empty',
    payloadFields: ['outcome'],
  },
  {
    id: 'registry-reference-plan-regression',
    signal: 'semantic_plan_guard_failure',
    windowMinutes: 0,
    severity: 'release-blocking',
    minimumRequests: 0,
    threshold: 0,
    runbookAnchor: 'plan-regression',
    payloadFields: ['outcome'],
  },
  {
    id: 'registry-reference-controlled-latency',
    signal: 'controlled_p95_or_p99_threshold',
    windowMinutes: 0,
    severity: 'release-blocking',
    minimumRequests: 0,
    threshold: 0,
    runbookAnchor: 'plan-regression',
    payloadFields: ['outcome'],
  },
  {
    id: 'shared-rate-limit-cleanup-backlog',
    signal: 'oldest_expired_over_24h_or_cleanup_not_progressing',
    windowMinutes: 0,
    severity: 'high',
    minimumRequests: 0,
    threshold: 0,
    runbookAnchor: 'cleanup-backlog',
    payloadFields: ['outcome'],
  },
]);

@Injectable()
export class RegistryReferenceTelemetry {
  private readonly samples: RegistryReferenceTelemetrySample[] = [];

  constructor(private readonly logger: ContextLoggerService) {}

  record(input: {
    outcome: RegistryReferenceOutcome;
    roles?: readonly Role[];
    featureState: RegistryReferenceFeatureState;
    resultCount?: number;
    queryLength?: number;
    durationMs: number;
  }): void {
    const resultCount = input.resultCount ?? 0;
    if (resultCount !== 0 && resultCount !== 1) {
      throw new Error('Registry reference telemetry result count must be 0 or 1');
    }
    const sample: RegistryReferenceTelemetrySample = Object.freeze({
      outcome: input.outcome,
      roleClass: this.roleClass(input.roles),
      featureState: input.featureState,
      resultCount,
      queryLengthBucket: this.queryLengthBucket(input.queryLength ?? 0),
      durationMs: Math.max(0, Number(input.durationMs.toFixed(3))),
    });
    this.samples.push(sample);
    const event = input.outcome === 'RATE_LIMITED'
      ? 'clinic.registry.reference_search.rate_limited'
      : input.outcome === 'POLICY_UNAVAILABLE'
        ? 'clinic.registry.reference_search.policy_unavailable'
        : input.outcome === 'INVARIANT_VIOLATION'
          ? 'clinic.registry.reference_search.invariant_violation'
          : 'clinic.registry.reference_search.completed';
    this.logger.event(
      input.outcome === 'INVARIANT_VIOLATION' ? 'error' : 'log',
      'RegistryReferenceTelemetry',
      event,
      {
        outcome: sample.outcome,
        duration_ms: sample.durationMs,
        result_count: sample.resultCount,
        feature_state: sample.featureState,
        query_length_bucket: sample.queryLengthBucket,
        role_class: sample.roleClass,
      },
    );
  }

  snapshot(): readonly RegistryReferenceTelemetrySample[] {
    return this.samples.map((sample) => Object.freeze({ ...sample }));
  }

  clear(): void {
    this.samples.length = 0;
  }

  static assertOperationalPayload(payload: Record<string, unknown>): void {
    const forbidden = Object.keys(payload).filter((key) => !SAFE_OPERATIONAL_FIELDS.has(key));
    if (forbidden.length > 0) throw new Error('Unsafe Registry reference telemetry fields');
  }

  private roleClass(roles: readonly Role[] | undefined): RegistryReferenceRoleClass {
    if (roles?.includes(Role.CLINIC_ADMIN)) return 'ADMIN';
    if (roles?.includes(Role.CLINIC_RECEPTIONIST)) return 'RECEPTION';
    return 'UNKNOWN';
  }

  private queryLengthBucket(length: number): RegistryReferenceQueryLengthBucket {
    if (length <= 0) return 'EMPTY';
    if (length <= 8) return 'SHORT';
    if (length <= 20) return 'MEDIUM';
    if (length <= 40) return 'LONG';
    return 'OVERSIZED';
  }
}
