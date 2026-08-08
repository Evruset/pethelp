import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Role } from '../src/auth/auth.types';
import { ClinicWorkspaceHomeService } from '../src/booking-core/clinic-workspace-home.service';
import { DatabaseService } from '../src/database/database.service';
import { NestRoot } from '../src/nest-root-full';
import { resetWorkspaceFixtures, workspaceOperationalFingerprint, WORKSPACE_IDS as IDS } from './clinic-workspace-home.fixtures';

jest.setTimeout(120_000);
describe('Clinic Workspace Home PostgreSQL projection', () => {
  let database: DatabaseService;
  let workspace: ClinicWorkspaceHomeService;
  let app: Awaited<ReturnType<typeof NestFactory.create>>;
  beforeAll(async () => {
    process.env.WORKERS_ENABLED = 'false';
    app = await NestFactory.create(NestRoot, { logger: false });
    await app.init();
    database = app.get(DatabaseService);
    workspace = app.get(ClinicWorkspaceHomeService);
  });
  beforeEach(async () => resetWorkspaceFixtures(database));
  afterAll(async () => app?.close());
  const employee = { sub: IDS.receptionist, roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [IDS.clinic], locationIds: [IDS.location] };

  it('returns database-time Queue and Appointments facts without mutating operational rows', async () => {
    const before = await workspaceOperationalFingerprint(database);
    const result = await workspace.read({ clinicId: IDS.clinic, locationId: IDS.location, employee });
    expect(result.serverNow).toBe(result.generatedAt);
    expect(result.sections.map((section) => section.kind)).toEqual(['QUEUE','SCHEDULE','APPOINTMENTS','VETERINARIAN','QUALITY']);
    expect(result.sections[0]).toMatchObject({ availability: 'AVAILABLE', facts: { waitingCount: 1, requiresActionCount: 1, oldestWaitAgeBucket: '5_TO_10_MIN', slaRisk: 'DUE_SOON' } });
    expect(result.sections[2]).toMatchObject({ availability: 'AVAILABLE', facts: { todayCount: 1, requiresActionCount: 0 } });
    expect((result.sections[2] as { facts: { nextScheduledAt: string } }).facts.nextScheduledAt).toEqual(expect.any(String));
    expect(await workspaceOperationalFingerprint(database)).toEqual(before);
  });

  it('uses overdue risk and an overdue non-terminal appointment action count', async () => {
    await database.query(`UPDATE booking_schema.booking_holds SET confirmation_sla_expires_at=clock_timestamp()-interval '1 minute' WHERE id=$1`, [IDS.queueHold]);
    await database.query(`UPDATE clinic_schema.appointment_slots SET starts_at=clock_timestamp()-interval '2 hours',ends_at=clock_timestamp()-interval '1 hour' WHERE id=$1`, [IDS.appointmentSlot]);
    const result = await workspace.read({ clinicId: IDS.clinic, locationId: IDS.location, employee });
    expect(result.sections[0]).toMatchObject({ facts: { slaRisk: 'OVERDUE' } });
    expect(result.sections[2]).toMatchObject({ facts: { requiresActionCount: 1, nextScheduledAt: null } });
  });

  it('returns authoritative empty summaries and saturates counts at 999', async () => {
    await database.query('DELETE FROM booking_schema.appointments');
    await database.query('DELETE FROM booking_schema.booking_holds');
    let result = await workspace.read({ clinicId: IDS.clinic, locationId: IDS.location, employee });
    expect(result.sections[0]).toMatchObject({ facts: { waitingCount: 0, requiresActionCount: 0, oldestWaitAgeBucket: 'NONE', slaRisk: 'NONE' } });
    expect(result.sections[2]).toMatchObject({ facts: { todayCount: 0, requiresActionCount: 0, nextScheduledAt: null } });
    await database.query(`INSERT INTO clinic_schema.appointment_slots (id,clinic_location_id,starts_at,ends_at,capacity,state,status,integration_mode) SELECT gen_random_uuid(),$1,clock_timestamp()+interval '1 hour',clock_timestamp()+interval '2 hours',1,'OPEN','AVAILABLE','LEVEL_C' FROM generate_series(1,1000)`, [IDS.location]);
    await database.query(`INSERT INTO booking_schema.booking_holds (slot_id,owner_id,pet_id,state,expires_at,state_changed_at,confirmation_sla_expires_at) SELECT id,$2,$3,'MANUAL_CONFIRM_PENDING',clock_timestamp()+interval '1 hour',clock_timestamp()-interval '1 minute',clock_timestamp()+interval '2 minutes' FROM clinic_schema.appointment_slots WHERE clinic_location_id=$1 AND id<>$4`, [IDS.location, IDS.owner, IDS.pet, IDS.appointmentSlot]);
    result = await workspace.read({ clinicId: IDS.clinic, locationId: IDS.location, employee });
    expect(result.sections[0]).toMatchObject({ facts: { waitingCount: 999, requiresActionCount: 999 } });
  });

  it('returns fifty concurrent reads without pool or mutation leakage', async () => {
    const beforeRows = await workspaceOperationalFingerprint(database);
    const beforePool = database.poolStats();
    const results = await Promise.all(Array.from({ length: 50 }, () => workspace.read({ clinicId: IDS.clinic, locationId: IDS.location, employee })));
    expect(results).toHaveLength(50);
    expect(new Set(results.map((result) => result.sections.map((section) => section.kind).join(',')))).toEqual(new Set(['QUEUE,SCHEDULE,APPOINTMENTS,VETERINARIAN,QUALITY']));
    expect(await workspaceOperationalFingerprint(database)).toEqual(beforeRows);
    await new Promise((resolve) => setImmediate(resolve));
    expect(database.poolStats().waitingCount).toBe(0);
    expect(database.poolStats().inUseCount).toBeLessThanOrEqual(beforePool.inUseCount);
  });
});
