import { Role } from '../src/auth/auth.types';
import { ContextLoggerService } from '../src/observability/context-logger.service';
import {
  CLINIC_WORKSPACE_HOME_OUTCOMES,
  ClinicWorkspaceHomeTelemetry,
} from '../src/observability/clinic-workspace-home-telemetry';

describe('Clinic workspace home telemetry', () => {
  it('records the closed outcome and role taxonomies with only bounded fields', () => {
    const logger = { eventWithoutActor: jest.fn() } as unknown as ContextLoggerService;
    const telemetry = new ClinicWorkspaceHomeTelemetry(logger);

    for (const outcome of CLINIC_WORKSPACE_HOME_OUTCOMES) {
      telemetry.record({
        outcome,
        roles: [Role.CLINIC_RECEPTIONIST, Role.CLINIC_VETERINARIAN],
        availableSections: ['APPOINTMENTS', 'QUEUE'],
        notAuthorizedSections: ['QUALITY'],
        notConfiguredSections: ['VETERINARIAN'],
        degradedSections: ['SCHEDULE'],
        freshnessState: 'FRESH',
        durationMs: 1.23456,
      });
    }

    expect(telemetry.snapshot().map((sample) => sample.outcome)).toEqual(
      CLINIC_WORKSPACE_HOME_OUTCOMES,
    );
    expect(telemetry.snapshot()[0]).toEqual({
      outcome: 'COMPLETE',
      roleClass: 'MULTI_ROLE',
      availableSections: ['QUEUE', 'APPOINTMENTS'],
      notAuthorizedSections: ['QUALITY'],
      notConfiguredSections: ['VETERINARIAN'],
      degradedSections: ['SCHEDULE'],
      freshnessState: 'FRESH',
      durationMs: 1.235,
    });
    const payload = (logger.eventWithoutActor as jest.Mock).mock.calls[0][3] as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual([
      'available_sections',
      'degraded_sections',
      'duration_ms',
      'freshness_state',
      'not_authorized_sections',
      'not_configured_sections',
      'outcome',
      'role_class',
    ].sort());
  });

  it.each([
    [[Role.CLINIC_RECEPTIONIST], 'RECEPTION'],
    [[Role.CLINIC_ADMIN], 'ADMIN'],
    [[Role.CLINIC_VETERINARIAN], 'VETERINARIAN'],
    [[Role.CLINIC_ADMIN, Role.CLINIC_ADMIN], 'ADMIN'],
    [[], 'UNKNOWN'],
    [[Role.OWNER], 'UNKNOWN'],
  ] as const)('normalizes role arrays %#', (roles, expectedRoleClass) => {
    const logger = { eventWithoutActor: jest.fn() } as unknown as ContextLoggerService;
    const telemetry = new ClinicWorkspaceHomeTelemetry(logger);
    telemetry.record({
      outcome: 'COMPLETE',
      roles,
      availableSections: [],
      notAuthorizedSections: [],
      notConfiguredSections: [],
      degradedSections: [],
      durationMs: 0,
    });
    expect(telemetry.snapshot()[0].roleClass).toBe(expectedRoleClass);
  });

  it('normalizes invalid durations and protects snapshots from mutation', () => {
    const logger = { eventWithoutActor: jest.fn() } as unknown as ContextLoggerService;
    const telemetry = new ClinicWorkspaceHomeTelemetry(logger);
    telemetry.record({
      outcome: 'PARTIAL',
      availableSections: ['QUEUE'],
      notAuthorizedSections: [],
      notConfiguredSections: [],
      degradedSections: ['APPOINTMENTS'],
      durationMs: Number.POSITIVE_INFINITY,
    });
    const snapshot = telemetry.snapshot();
    expect(snapshot[0].durationMs).toBe(0);
    expect(snapshot[0].freshnessState).toBe('UNKNOWN');
    expect(Object.isFrozen(snapshot[0])).toBe(true);
    expect(Object.isFrozen(snapshot[0].availableSections)).toBe(true);
    telemetry.clear();
    expect(telemetry.snapshot()).toEqual([]);
    expect(snapshot).toHaveLength(1);
  });

  it('rejects non-allowlisted operational fields', () => {
    expect(() => ClinicWorkspaceHomeTelemetry.assertOperationalPayload({
      outcome: 'TECHNICAL_ERROR',
      clinicId: 'forbidden',
    })).toThrow('Unsafe Clinic workspace home telemetry fields');
  });

  it.each([
    [['UNKNOWN'], [], [], [], 'Unknown'],
    [['QUEUE', 'QUEUE'], [], [], [], 'Duplicate'],
    [['QUEUE'], ['QUEUE'], [], [], 'Duplicate'],
    [['QUEUE', 'SCHEDULE', 'APPOINTMENTS', 'VETERINARIAN', 'QUALITY', 'QUEUE'], [], [], [], 'exceeds'],
  ])('rejects invalid section arrays %#', (
    availableSections,
    notAuthorizedSections,
    notConfiguredSections,
    degradedSections,
    message,
  ) => {
    const telemetry = new ClinicWorkspaceHomeTelemetry({ eventWithoutActor: jest.fn() } as never);
    expect(() => telemetry.record({
      outcome: 'COMPLETE',
      availableSections,
      notAuthorizedSections,
      notConfiguredSections,
      degradedSections,
      durationMs: 0,
    })).toThrow(message);
    expect(telemetry.snapshot()).toEqual([]);
  });
});
