import type { PoolClient } from 'pg';
import { Role } from '../src/auth/auth.types';
import { ClinicEmployeeAccessService } from '../src/booking-core/clinic-employee-access.service';
import { ClinicWorkspaceHomeService } from '../src/booking-core/clinic-workspace-home.service';
import type { DatabaseService } from '../src/database/database.service';
import type { ClinicWorkspaceHomeTelemetry } from '../src/observability/clinic-workspace-home-telemetry';

const clinicId = '82000000-0000-4000-8000-000000000001';
const locationId = '83000000-0000-4000-8000-000000000001';
const sub = '81000000-0000-4000-8000-000000000002';
const now = new Date('2026-07-31T10:00:00.000Z');

describe('Clinic Workspace Home query behavior', () => {
  it('executes one authority query and zero operational SQL for a veterinarian', async () => {
    const { service, queries } = harness();
    const result = await service.read({ clinicId, locationId, employee: { sub, roles: [Role.CLINIC_VETERINARIAN], clinicIds: [clinicId], locationIds: [locationId] } });
    expect(queries.filter((sql) => sql.includes('employee_location_memberships membership'))).toHaveLength(1);
    expect(queries.filter(isOperational)).toHaveLength(0);
    expect(result.sections.map((section) => section.availability)).toEqual(['NOT_AUTHORIZED','NOT_AUTHORIZED','NOT_AUTHORIZED','NOT_CONFIGURED','NOT_AUTHORIZED']);
  });

  it('uses exactly two summaries with ordered savepoints for receptionist capabilities', async () => {
    const { service, queries } = harness();
    await service.read({ clinicId, locationId, employee: { sub, roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [clinicId], locationIds: [locationId] } });
    expect(queries.filter((sql) => sql.includes('employee_location_memberships membership'))).toHaveLength(1);
    expect(queries.filter(isOperational)).toHaveLength(2);
    expect(queries.filter((sql) => /SAVEPOINT|RELEASE SAVEPOINT/.test(sql))).toEqual(['SAVEPOINT workspace_queue','RELEASE SAVEPOINT workspace_queue','SAVEPOINT workspace_appointments','RELEASE SAVEPOINT workspace_appointments']);
    expect(queries.some((sql) => /INSERT|UPDATE|DELETE/i.test(sql))).toBe(false);
  });

  it('degrades only a recoverable section and rethrows an unknown SQL defect', async () => {
    const recoverable = harness('57014');
    const partial = await recoverable.service.read({ clinicId, locationId, employee: { sub, roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [clinicId], locationIds: [locationId] } });
    expect(partial.sections[0]).toEqual({ kind: 'QUEUE', availability: 'TEMPORARILY_UNAVAILABLE', generatedAt: now.toISOString() });
    expect(recoverable.queries).toContain('ROLLBACK TO SAVEPOINT workspace_queue');
    const unknown = harness('42P01');
    await expect(unknown.service.read({ clinicId, locationId, employee: { sub, roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [clinicId], locationIds: [locationId] } })).rejects.toMatchObject({ code: '42P01' });
    expect(unknown.queries).not.toContain('ROLLBACK TO SAVEPOINT workspace_queue');
  });
});

function harness(queueError?: string): { service: ClinicWorkspaceHomeService; queries: string[] } {
  const queries: string[] = [];
  const client = { query: jest.fn(async (sql: string) => {
    queries.push(sql.trim().replace(/\s+/g, ' '));
    if (sql.includes('employee_location_memberships membership')) return { rows: [{ server_now: now, timezone: 'Europe/Moscow' }] };
    if (sql.includes('booking_schema.booking_holds')) {
      if (queueError) throw Object.assign(new Error('hidden'), { code: queueError });
      return { rows: [{ waiting_count: '1', requires_action_count: '0', oldest_age_seconds: '60', has_overdue: false, has_due_soon: false, has_inconsistent: false }] };
    }
    if (sql.includes('booking_schema.appointments')) return { rows: [{ today_count: '0', requires_action_count: '0', next_scheduled_at: null }] };
    return { rows: [] };
  }) } as unknown as PoolClient;
  const database = { withTransaction: jest.fn(async (work) => work(client)) } as unknown as DatabaseService;
  const telemetry = { record: jest.fn() } as unknown as ClinicWorkspaceHomeTelemetry;
  return { service: new ClinicWorkspaceHomeService(database, new ClinicEmployeeAccessService(), telemetry), queries };
}
function isOperational(sql: string): boolean { return sql.includes('booking_schema.booking_holds') || sql.includes('booking_schema.appointments'); }
