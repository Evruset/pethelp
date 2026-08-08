import { Injectable } from '@nestjs/common';
import { Role } from '../auth/auth.types';
import { ContextLoggerService } from './context-logger.service';

export const CLINIC_WORKSPACE_HOME_OUTCOMES = [
  'COMPLETE',
  'PARTIAL',
  'AUTH_DENIED',
  'VALIDATION_REJECTED',
  'TECHNICAL_ERROR',
] as const;

export type ClinicWorkspaceHomeOutcome = typeof CLINIC_WORKSPACE_HOME_OUTCOMES[number];
export type ClinicWorkspaceHomeRoleClass =
  | 'RECEPTION'
  | 'ADMIN'
  | 'VETERINARIAN'
  | 'MULTI_ROLE'
  | 'UNKNOWN';
export type ClinicWorkspaceHomeFreshnessState = 'FRESH' | 'STALE' | 'UNKNOWN';
export type ClinicWorkspaceHomeSectionKind =
  | 'QUEUE'
  | 'SCHEDULE'
  | 'APPOINTMENTS'
  | 'VETERINARIAN'
  | 'QUALITY';

export type ClinicWorkspaceHomeTelemetrySample = Readonly<{
  outcome: ClinicWorkspaceHomeOutcome;
  roleClass: ClinicWorkspaceHomeRoleClass;
  availableSections: readonly ClinicWorkspaceHomeSectionKind[];
  notAuthorizedSections: readonly ClinicWorkspaceHomeSectionKind[];
  notConfiguredSections: readonly ClinicWorkspaceHomeSectionKind[];
  degradedSections: readonly ClinicWorkspaceHomeSectionKind[];
  freshnessState: ClinicWorkspaceHomeFreshnessState;
  durationMs: number;
}>;

const SECTION_KINDS: readonly ClinicWorkspaceHomeSectionKind[] = Object.freeze([
  'QUEUE',
  'SCHEDULE',
  'APPOINTMENTS',
  'VETERINARIAN',
  'QUALITY',
]);
const SECTION_KIND_SET = new Set<string>(SECTION_KINDS);
const SAFE_OPERATIONAL_FIELDS = new Set([
  'outcome',
  'role_class',
  'available_sections',
  'not_authorized_sections',
  'not_configured_sections',
  'degraded_sections',
  'freshness_state',
  'duration_ms',
]);

@Injectable()
export class ClinicWorkspaceHomeTelemetry {
  private readonly samples: ClinicWorkspaceHomeTelemetrySample[] = [];

  constructor(private readonly logger: ContextLoggerService) {}

  record(input: {
    outcome: ClinicWorkspaceHomeOutcome;
    roles?: readonly Role[];
    availableSections: readonly string[];
    notAuthorizedSections: readonly string[];
    notConfiguredSections: readonly string[];
    degradedSections: readonly string[];
    freshnessState?: ClinicWorkspaceHomeFreshnessState;
    durationMs: number;
  }): void {
    const seenSections = new Set<ClinicWorkspaceHomeSectionKind>();
    const sample: ClinicWorkspaceHomeTelemetrySample = Object.freeze({
      outcome: input.outcome,
      roleClass: this.roleClass(input.roles),
      availableSections: this.sectionKinds(input.availableSections, seenSections),
      notAuthorizedSections: this.sectionKinds(input.notAuthorizedSections, seenSections),
      notConfiguredSections: this.sectionKinds(input.notConfiguredSections, seenSections),
      degradedSections: this.sectionKinds(input.degradedSections, seenSections),
      freshnessState: input.freshnessState ?? 'UNKNOWN',
      durationMs: this.duration(input.durationMs),
    });
    this.samples.push(sample);

    const payload = {
      outcome: sample.outcome,
      role_class: sample.roleClass,
      available_sections: sample.availableSections,
      not_authorized_sections: sample.notAuthorizedSections,
      not_configured_sections: sample.notConfiguredSections,
      degraded_sections: sample.degradedSections,
      freshness_state: sample.freshnessState,
      duration_ms: sample.durationMs,
    };
    ClinicWorkspaceHomeTelemetry.assertOperationalPayload(payload);
    this.logger.eventWithoutActor(
      input.outcome === 'TECHNICAL_ERROR' ? 'error' : 'log',
      'ClinicWorkspaceHomeTelemetry',
      'clinic.workspace_home.completed',
      payload,
    );
  }

  snapshot(): readonly ClinicWorkspaceHomeTelemetrySample[] {
    return this.samples.map((sample) => Object.freeze({
      ...sample,
      availableSections: Object.freeze([...sample.availableSections]),
      notAuthorizedSections: Object.freeze([...sample.notAuthorizedSections]),
      notConfiguredSections: Object.freeze([...sample.notConfiguredSections]),
      degradedSections: Object.freeze([...sample.degradedSections]),
    }));
  }

  clear(): void {
    this.samples.length = 0;
  }

  static assertOperationalPayload(payload: Record<string, unknown>): void {
    const forbidden = Object.keys(payload).filter((key) => !SAFE_OPERATIONAL_FIELDS.has(key));
    if (forbidden.length > 0) throw new Error('Unsafe Clinic workspace home telemetry fields');
  }

  private roleClass(roles: readonly Role[] | undefined): ClinicWorkspaceHomeRoleClass {
    const recognized = new Set<ClinicWorkspaceHomeRoleClass>();
    if (roles?.includes(Role.CLINIC_RECEPTIONIST)) recognized.add('RECEPTION');
    if (roles?.includes(Role.CLINIC_ADMIN)) recognized.add('ADMIN');
    if (roles?.includes(Role.CLINIC_VETERINARIAN)) recognized.add('VETERINARIAN');
    if (recognized.size > 1) return 'MULTI_ROLE';
    return recognized.values().next().value ?? 'UNKNOWN';
  }

  private sectionKinds(
    values: readonly string[],
    seenSections: Set<ClinicWorkspaceHomeSectionKind>,
  ): readonly ClinicWorkspaceHomeSectionKind[] {
    if (values.length > SECTION_KINDS.length) {
      throw new Error('Clinic workspace home telemetry section array exceeds five kinds');
    }
    const normalized = new Set<ClinicWorkspaceHomeSectionKind>();
    for (const value of values) {
      if (!SECTION_KIND_SET.has(value)) {
        throw new Error('Unknown Clinic workspace home telemetry section kind');
      }
      const kind = value as ClinicWorkspaceHomeSectionKind;
      if (normalized.has(kind) || seenSections.has(kind)) {
        throw new Error('Duplicate Clinic workspace home telemetry section kind');
      }
      normalized.add(kind);
      seenSections.add(kind);
    }
    return Object.freeze(SECTION_KINDS.filter((kind) => normalized.has(kind)));
  }

  private duration(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Number(value.toFixed(3)));
  }
}
