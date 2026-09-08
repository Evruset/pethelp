import { randomUUID } from 'node:crypto';
import { resetBookingPersistence } from './helpers/booking-test-reset';
import { DatabaseService } from '../src/database/database.service';
import {
  ClinicPatientAssociationLifecycleService,
  type AppointmentEvidence,
} from '../src/booking-core/clinic-patient-association-lifecycle.service';

jest.setTimeout(120_000);

const IDS = {
  owner: '92000000-0000-4000-8000-000000000001',
  clinic: '92000000-0000-4000-8000-000000000002',
  location: '92000000-0000-4000-8000-000000000003',
  service: '92000000-0000-4000-8000-000000000004',
  pet: '92000000-0000-4000-8000-000000000005',
  consent: '92000000-0000-4000-8000-000000000006',
  otherLocation: '92000000-0000-4000-8000-000000000007',
  foreignConsent: '92000000-0000-4000-8000-000000000008',
  appointment1: '92000000-0000-4000-8000-000000000011',
  appointment2: '92000000-0000-4000-8000-000000000012',
};
const database = new DatabaseService();

describe('clinic patient association lifecycle write path', () => {
  const service = new ClinicPatientAssociationLifecycleService(database);

  beforeAll(() => {
    process.env.VETHELP_CLINIC_PATIENT_VISIBILITY_POLICY_VERSION = 'test-v1';
    process.env.VETHELP_CLINIC_PATIENT_VISIBILITY_DAYS = '365';
  });
  beforeEach(async () => {
    await reset();
    await seed();
  });
  afterAll(async () => {
    await reset();
    delete process.env.VETHELP_CLINIC_PATIENT_VISIBILITY_POLICY_VERSION;
    delete process.env.VETHELP_CLINIC_PATIENT_VISIBILITY_DAYS;
    await database.onModuleDestroy();
  });

  it('activates from exact qualifying evidence with aligned receipt, revision and safe outbox', async () => {
    const result = await service.applyQualifyingAppointmentEvidence(evidence(IDS.appointment1));
    expect(result).toMatchObject({ kind: 'APPLIED', status: 'ACTIVE', version: 1, transition: 'ACTIVATED' });
    const state = await lifecycleState();
    expect(state).toMatchObject({ status: 'ACTIVE', version: 1, receipts: '1', revisions: '1', outbox: '1' });
    expect(state.first_qualified_at).toEqual(state.last_qualified_at);
    expect(state.current_consent_id).toBe(IDS.consent);
    expect(state.outbox_version).toBe(1);
    expect(Object.keys(state.payload_json).sort()).toEqual([
      'aggregateVersion', 'associationId', 'clinicId', 'eventId', 'locationId',
      'petId', 'sourceAppointmentId', 'tenantId', 'transition',
    ]);
    expect(JSON.stringify(state.payload_json)).not.toMatch(/owner|phone|email|diagnos|clinical|prescription/i);
  });

  it('fails closed for missing policy, invalid consent and non-appointment hold evidence', async () => {
    delete process.env.VETHELP_CLINIC_PATIENT_VISIBILITY_DAYS;
    expect(await service.applyQualifyingAppointmentEvidence(evidence(IDS.appointment1)))
      .toEqual({ kind: 'REJECTED', code: 'POLICY_UNAVAILABLE' });
    process.env.VETHELP_CLINIC_PATIENT_VISIBILITY_DAYS = '365';

    await database.query(`
      UPDATE clinic_schema.clinic_patient_consents
      SET granted_at=clock_timestamp()-interval '2 days',
          expires_at=clock_timestamp()-interval '1 day'
    `);
    expect(await service.applyQualifyingAppointmentEvidence(evidence(IDS.appointment1)))
      .toEqual({ kind: 'REJECTED', code: 'CONSENT_INVALID' });
    await database.query('UPDATE clinic_schema.clinic_patient_consents SET expires_at=clock_timestamp()+interval \'1 day\'');

    for (const state of ['MANUAL_CONFIRM_PENDING', 'EXPIRED', 'RELEASED']) {
      const holdId = randomUUID();
      await database.query(`
        INSERT INTO booking_schema.booking_holds
          (id,slot_id,owner_id,pet_id,state,expires_at)
        VALUES ($1,$2,$3,$4,$5,clock_timestamp()+interval '1 hour')
      `, [holdId, slotId(1), IDS.owner, IDS.pet, state]);
      expect(await service.applyQualifyingAppointmentEvidence(evidence(randomUUID())))
        .toEqual({ kind: 'REJECTED', code: 'EVIDENCE_NOT_QUALIFYING' });
    }
    expect(await counts()).toEqual({ associations: '0', receipts: '0', revisions: '0', outbox: '0' });
  });

  it('makes replay and concurrent duplicate a no-op without version inflation', async () => {
    const input = evidence(IDS.appointment1);
    const [first, second] = await Promise.all([
      service.applyQualifyingAppointmentEvidence(input),
      service.applyQualifyingAppointmentEvidence(input),
    ]);
    expect([first.kind, second.kind].sort()).toEqual(['APPLIED', 'REPLAY']);
    expect(await service.applyQualifyingAppointmentEvidence(input))
      .toMatchObject({ kind: 'REPLAY', version: 1 });
    expect(await counts()).toEqual({ associations: '1', receipts: '1', revisions: '1', outbox: '1' });
  });

  it('recognizes durable replay after mutable appointment status and version change', async () => {
    const input = evidence(IDS.appointment1);
    await service.applyQualifyingAppointmentEvidence(input);
    await database.query(`
      UPDATE booking_schema.appointments
      SET status='UNKNOWN_AFTER_PROCESSING', version=version+1
      WHERE id=$1
    `, [IDS.appointment1]);
    delete process.env.VETHELP_CLINIC_PATIENT_VISIBILITY_POLICY_VERSION;
    expect(await service.applyQualifyingAppointmentEvidence(input))
      .toMatchObject({ kind: 'REPLAY', version: 1, status: 'ACTIVE' });
    process.env.VETHELP_CLINIC_PATIENT_VISIBILITY_POLICY_VERSION = 'test-v1';
    expect(await counts()).toEqual({ associations: '1', receipts: '1', revisions: '1', outbox: '1' });
  });

  it('serializes different first events for one scope while independent pet scopes both complete', async () => {
    const sameScope = await Promise.all([
      service.applyQualifyingAppointmentEvidence(evidence(IDS.appointment1)),
      service.applyQualifyingAppointmentEvidence(evidence(IDS.appointment2)),
    ]);
    expect(sameScope.filter((result) => result.kind === 'APPLIED')).toHaveLength(1);
    expect(sameScope.filter((result) => result.kind === 'REJECTED')).toHaveLength(1);
    expect((await counts()).associations).toBe('1');

    await reset();
    await seed();
    const otherPet = randomUUID();
    const otherConsent = randomUUID();
    const otherAppointment = randomUUID();
    await database.query(`INSERT INTO pet_schema.pets(id,owner_id,name,species) VALUES ($1,$2,'Other private pet','DOG')`, [otherPet, IDS.owner]);
    await insertAppointment(otherAppointment, 4, otherPet);
    await insertConsent(otherConsent, otherPet);
    const results = await Promise.all([
      service.applyQualifyingAppointmentEvidence(evidence(IDS.appointment1)),
      service.applyQualifyingAppointmentEvidence(evidence(otherAppointment, {
        petId: otherPet, consentId: otherConsent,
      })),
    ]);
    expect(results.every((result) => result.kind === 'APPLIED')).toBe(true);
    expect((await counts()).associations).toBe('2');
  });

  it('refreshes once, preserves first evidence and rejects stale optimistic versions', async () => {
    await service.applyQualifyingAppointmentEvidence(evidence(IDS.appointment1));
    const before = await lifecycleState();
    const refreshed = await service.applyQualifyingAppointmentEvidence(evidence(IDS.appointment2, {
      expectedAssociationVersion: 1,
    }));
    expect(refreshed).toMatchObject({ kind: 'APPLIED', version: 2, transition: 'REFRESHED' });
    const after = await lifecycleState();
    expect(after.first_qualified_at).toEqual(before.first_qualified_at);
    expect(new Date(after.last_qualified_at).getTime()).toBeGreaterThan(new Date(before.last_qualified_at).getTime());
    expect(await service.applyQualifyingAppointmentEvidence(evidence(IDS.appointment2, {
      sourceEventId: randomUUID(),
      expectedAssociationVersion: 1,
    }))).toEqual({ kind: 'REJECTED', code: 'VERSION_CONFLICT' });
    expect((await lifecycleState()).version).toBe(2);
  });

  it('rejects appointment pet/location/clinic/tenant and foreign-consent scope without effects', async () => {
    const variants: AppointmentEvidence[] = [
      evidence(IDS.appointment1, { tenantId: randomUUID() }),
      evidence(IDS.appointment1, { clinicId: randomUUID(), tenantId: randomUUID() }),
      evidence(IDS.appointment1, { locationId: randomUUID() }),
      evidence(IDS.appointment1, { petId: randomUUID() }),
      evidence(IDS.appointment1, { consentId: IDS.foreignConsent }),
    ];
    for (const input of variants) {
      expect((await service.applyQualifyingAppointmentEvidence(input)).kind).toBe('REJECTED');
    }
    expect(await counts()).toEqual({ associations: '0', receipts: '0', revisions: '0', outbox: '0' });
  });

  it('archives without deletion and keeps history/outbox aligned', async () => {
    await service.applyQualifyingAppointmentEvidence(evidence(IDS.appointment1));
    await database.query('UPDATE pet_schema.pets SET archived_at=clock_timestamp() WHERE id=$1', [IDS.pet]);
    const result = await service.archiveAssociation({
      ...scope(), sourceEventId: randomUUID(), sourceAggregateVersion: 1,
      expectedAssociationVersion: 1, reason: 'PET_ARCHIVED',
    });
    expect(result).toMatchObject({ kind: 'APPLIED', status: 'ARCHIVED', version: 2 });
    expect(await counts()).toEqual({ associations: '1', receipts: '2', revisions: '2', outbox: '2' });
    expect((await database.query('SELECT COUNT(*)::text count FROM booking_schema.appointments')).rows[0].count).toBe('2');
  });

  it('makes revoke win a racing refresh and blocks delayed old activation', async () => {
    await service.applyQualifyingAppointmentEvidence(evidence(IDS.appointment1));
    const revoke = {
      ...scope(), sourceEventId: randomUUID(), sourceAggregateVersion: 1,
      expectedAssociationVersion: 1, consentId: IDS.consent,
      actorType: 'OWNER', actorId: IDS.owner, reason: 'CONSENT_WITHDRAWN' as const,
    };
    const refresh = evidence(IDS.appointment2, { expectedAssociationVersion: 1 });
    await Promise.all([
      service.applyQualifyingAppointmentEvidence(refresh),
      service.revokeAssociation(revoke),
    ]);
    const state = await lifecycleState();
    expect(state.status).toBe('REVOKED');
    expect(state.revoked_at).not.toBeNull();
    expect(await service.applyQualifyingAppointmentEvidence(evidence(IDS.appointment1, {
      sourceEventId: randomUUID(), expectedAssociationVersion: state.version,
    }))).toEqual({ kind: 'REJECTED', code: 'CONSENT_INVALID' });
  });

  it('reactivates stable identity only with new consent and new appointment', async () => {
    const activated = await service.applyQualifyingAppointmentEvidence(evidence(IDS.appointment1));
    await service.revokeAssociation({
      ...scope(), sourceEventId: randomUUID(), sourceAggregateVersion: 1,
      expectedAssociationVersion: 1, consentId: IDS.consent,
      actorType: 'OWNER', actorId: IDS.owner, reason: 'CONSENT_WITHDRAWN',
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const consent2 = randomUUID();
    await insertConsent(consent2);
    const appointment3 = randomUUID();
    await insertAppointment(appointment3, 3);
    const result = await service.applyQualifyingAppointmentEvidence(evidence(appointment3, {
      consentId: consent2, expectedAssociationVersion: 2,
    }));
    expect(result).toMatchObject({
      kind: 'APPLIED', associationId: (activated as { associationId: string }).associationId,
      status: 'ACTIVE', version: 3, transition: 'REACTIVATED',
    });
    expect((await lifecycleState()).current_consent_id).toBe(consent2);
    expect(await counts()).toEqual({ associations: '1', receipts: '3', revisions: '3', outbox: '3' });
  });

  it('rolls back association, receipt, revision and outbox on a forced downstream failure', async () => {
    await expect(service.applyQualifyingAppointmentEvidence(evidence(IDS.appointment1, {
      sourceEventId: 'not-a-uuid',
    }))).rejects.toThrow();
    expect(await counts()).toEqual({ associations: '0', receipts: '0', revisions: '0', outbox: '0' });

    await database.query(`
      CREATE OR REPLACE FUNCTION clinic_schema.fail_patient_revision() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled revision failure'; END $$
    `);
    await database.query(`
      CREATE TRIGGER fail_patient_revision BEFORE INSERT
      ON clinic_schema.clinic_patient_association_revisions
      FOR EACH ROW EXECUTE FUNCTION clinic_schema.fail_patient_revision()
    `);
    try {
      await expect(service.applyQualifyingAppointmentEvidence(evidence(IDS.appointment1))).rejects.toThrow();
      expect(await counts()).toEqual({ associations: '0', receipts: '0', revisions: '0', outbox: '0' });
    } finally {
      await database.query('DROP TRIGGER IF EXISTS fail_patient_revision ON clinic_schema.clinic_patient_association_revisions');
      await database.query('DROP FUNCTION IF EXISTS clinic_schema.fail_patient_revision()');
    }
  });
});

function scope() {
  return { tenantId: IDS.clinic, clinicId: IDS.clinic, locationId: IDS.location, petId: IDS.pet };
}

function evidence(appointmentId: string, overrides: Partial<AppointmentEvidence> = {}): AppointmentEvidence {
  return {
    ...scope(),
    sourceEventId: randomUUID(),
    sourceAppointmentId: appointmentId,
    sourceAggregateVersion: 1,
    consentId: IDS.consent,
    ...overrides,
  };
}

async function reset() {
  await database.query(`
    TRUNCATE clinic_schema.clinics, pet_schema.pets, identity_schema.users CASCADE
  `);
  await resetBookingPersistence(database);
}

async function seed() {
  await database.query('INSERT INTO identity_schema.users(id) VALUES ($1)', [IDS.owner]);
  await database.query(`INSERT INTO clinic_schema.clinics(id,legal_name,public_name) VALUES ($1,'Lifecycle LLC','Lifecycle')`, [IDS.clinic]);
  await database.query(`
    INSERT INTO clinic_schema.clinic_locations(id,clinic_id,address)
    VALUES ($1,$2,'Lifecycle'),($3,$2,'Other location')
  `, [IDS.location, IDS.clinic, IDS.otherLocation]);
  await database.query(`INSERT INTO clinic_schema.clinic_services(id,clinic_location_id,code,display_name,duration_minutes) VALUES ($1,$2,'LIFE','Lifecycle',30)`, [IDS.service, IDS.location]);
  await database.query(`INSERT INTO pet_schema.pets(id,owner_id,name,species) VALUES ($1,$2,'Private Pet','CAT')`, [IDS.pet, IDS.owner]);
  await insertAppointment(IDS.appointment1, 1);
  await new Promise((resolve) => setTimeout(resolve, 5));
  await insertAppointment(IDS.appointment2, 2);
  await insertConsent(IDS.consent);
  await insertConsent(IDS.foreignConsent, IDS.pet, IDS.otherLocation);
}

async function insertAppointment(id: string, ordinal: number, petId = IDS.pet) {
  const slot = slotId(ordinal);
  const hold = holdId(ordinal);
  await database.query(`
    INSERT INTO clinic_schema.appointment_slots
      (id,clinic_location_id,service_id,starts_at,ends_at,capacity,status,integration_mode)
    VALUES ($1,$2,$3,clock_timestamp()+interval '1 day',
      clock_timestamp()+interval '1 day 30 minutes',1,'BOOKED','LEVEL_C')
  `, [slot, IDS.location, IDS.service]);
  await database.query(`
    INSERT INTO booking_schema.booking_holds(id,slot_id,owner_id,pet_id,state,expires_at)
    VALUES ($1,$2,$3,$4,'CONFIRMED',clock_timestamp()+interval '1 day')
  `, [hold, slot, IDS.owner, petId]);
  await database.query(`
    INSERT INTO booking_schema.appointments
      (id,hold_id,owner_id,pet_id,clinic_location_id,slot_id,status)
    VALUES ($1,$2,$3,$4,$5,$6,'CONFIRMED')
  `, [id, hold, IDS.owner, petId, IDS.location, slot]);
}

async function insertConsent(id: string, petId = IDS.pet, locationId = IDS.location) {
  await database.query(`
    INSERT INTO clinic_schema.clinic_patient_consents (
      id,clinic_id,clinic_location_id,pet_id,subject_owner_id,purpose,
      consent_version,source,actor_type,actor_id,granted_at,expires_at)
    VALUES ($1,$2,$3,$4,$5,'PATIENT_ADMIN_REGISTRY','test-v1',
      'OWNER_BOOKING','OWNER',$5::uuid::text,clock_timestamp(),clock_timestamp()+interval '1 day')
  `, [id, IDS.clinic, locationId, petId, IDS.owner]);
}

async function counts() {
  return (await database.query<{
    associations: string; receipts: string; revisions: string; outbox: string;
  }>(`
    SELECT
      (SELECT COUNT(*) FROM clinic_schema.clinic_patient_associations)::text associations,
      (SELECT COUNT(*) FROM clinic_schema.clinic_patient_association_event_receipts)::text receipts,
      (SELECT COUNT(*) FROM clinic_schema.clinic_patient_association_revisions)::text revisions,
      (SELECT COUNT(*) FROM booking_schema.outbox_events
        WHERE aggregate_type='ClinicPatientAssociation')::text outbox
  `)).rows[0];
}

async function lifecycleState() {
  return (await database.query<any>(`
    SELECT association.*, consent.id::text current_consent_id,
      (SELECT COUNT(*)::text FROM clinic_schema.clinic_patient_association_event_receipts) receipts,
      (SELECT COUNT(*)::text FROM clinic_schema.clinic_patient_association_revisions) revisions,
      (SELECT COUNT(*)::text FROM booking_schema.outbox_events
        WHERE aggregate_type='ClinicPatientAssociation') outbox,
      event.aggregate_version outbox_version, event.payload_json
    FROM clinic_schema.clinic_patient_associations association
    JOIN clinic_schema.clinic_patient_consents consent ON consent.id=association.current_consent_id
    LEFT JOIN LATERAL (
      SELECT aggregate_version,payload_json FROM booking_schema.outbox_events
      WHERE aggregate_id=association.id ORDER BY aggregate_version DESC LIMIT 1
    ) event ON true
    LIMIT 1
  `)).rows[0];
}

function slotId(ordinal: number) {
  return `93000000-0000-4000-8000-${String(ordinal).padStart(12, '0')}`;
}
function holdId(ordinal: number) {
  return `94000000-0000-4000-8000-${String(ordinal).padStart(12, '0')}`;
}
