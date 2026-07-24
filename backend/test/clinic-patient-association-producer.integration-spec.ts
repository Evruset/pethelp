import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { Role, type JwtPayload } from '../src/auth/auth.types';
import { BookingSecurityService } from '../src/booking-core/booking-security.service';
import { BookingErrorFilter } from '../src/common/booking-error.filter';
import { config } from '../src/config';
import { DatabaseService } from '../src/database/database.service';
import { NestRoot } from '../src/nest-root-full';

jest.setTimeout(90_000);
let app: INestApplication;
let database: DatabaseService;
let booking: BookingSecurityService;
let jwt: JwtService;

describe('clinic patient association manual-confirm producer wiring', () => {
  beforeAll(async () => {
    process.env.VETHELP_CLINIC_PATIENT_VISIBILITY_POLICY_VERSION = 'producer-test-v1';
    process.env.VETHELP_CLINIC_PATIENT_VISIBILITY_DAYS = '365';
    process.env.WORKERS_ENABLED = 'false';
    app = await NestFactory.create(NestRoot, { logger: false });
    app.useGlobalFilters(new BookingErrorFilter());
    await app.init();
    database = app.get(DatabaseService);
    booking = app.get(BookingSecurityService);
    jwt = app.get(JwtService);
  });
  afterAll(async () => {
    delete process.env.VETHELP_CLINIC_PATIENT_VISIBILITY_POLICY_VERSION;
    delete process.env.VETHELP_CLINIC_PATIENT_VISIBILITY_DAYS;
    await app?.close();
  });

  it('atomically projects authoritative manual confirmation with durable event identity', async () => {
    const fixture = await seed(true);
    const result = await booking.confirmManualHold(command(fixture));
    expect(result).toMatchObject({ holdId: fixture.holdId, state: 'CONFIRMED' });

    const state = await producerState(fixture.holdId);
    expect(state).toMatchObject({
      hold_state: 'CONFIRMED',
      hold_version: 2,
      appointments: '1',
      associations: '1',
      association_version: 1,
      receipts: '1',
      revisions: '1',
      association_events: '1',
      booking_confirmed_events: '1',
    });
    expect(state.receipt_event_id).toBe(state.appointment_event_id);
    expect(state.receipt_appointment_id).toBe(result.appointmentId);
    expect(state.association_pet_id).toBe(fixture.petId);
    expect(state.association_location_id).toBe(fixture.locationId);
  });

  it('keeps confirmation authoritative but creates no association without valid consent', async () => {
    for (const mode of ['MISSING', 'EXPIRED'] as const) {
      const fixture = await seed(mode === 'MISSING' ? false : 'EXPIRED');
      await expect(booking.confirmManualHold(command(fixture))).resolves.toMatchObject({
        state: 'CONFIRMED',
      });
      const state = await producerState(fixture.holdId);
      expect(state.appointments).toBe('1');
      expect(state.booking_confirmed_events).toBe('1');
      expect(state.associations).toBe('0');
      expect(state.receipts).toBe('0');
      expect(state.revisions).toBe('0');
      expect(state.association_events).toBe('0');
    }

    const policyFixture = await seed(true);
    delete process.env.VETHELP_CLINIC_PATIENT_VISIBILITY_POLICY_VERSION;
    await expect(booking.confirmManualHold(command(policyFixture))).resolves.toMatchObject({
      state: 'CONFIRMED',
    });
    process.env.VETHELP_CLINIC_PATIENT_VISIBILITY_POLICY_VERSION = 'producer-test-v1';
    const policyState = await producerState(policyFixture.holdId);
    expect(policyState.appointments).toBe('1');
    expect(policyState.associations).toBe('0');
    expect(policyState.receipts).toBe('0');
    expect(policyState.revisions).toBe('0');
    expect(policyState.association_events).toBe('0');
  });

  it('deduplicates HTTP replay and concurrent confirm without a second lifecycle effect', async () => {
    const fixture = await seed(true);
    const key = randomUUID();
    const first = await httpConfirm(fixture, key);
    const replay = await httpConfirm(fixture, key);
    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(replay.body).toEqual(first.body);
    expect(await producerState(fixture.holdId)).toMatchObject({
      appointments: '1',
      associations: '1',
      receipts: '1',
      revisions: '1',
      association_events: '1',
      booking_confirmed_events: '1',
    });

    const concurrentFixture = await seed(true);
    const attempts = await Promise.all([
      httpConfirm(concurrentFixture, randomUUID()),
      httpConfirm(concurrentFixture, randomUUID()),
    ]);
    expect(attempts.map((attempt) => attempt.status).sort()).toEqual([200, 409]);
    expect(await producerState(concurrentFixture.holdId)).toMatchObject({
      appointments: '1',
      associations: '1',
      receipts: '1',
      revisions: '1',
      association_events: '1',
      booking_confirmed_events: '1',
    });
  });

  it('rolls back appointment confirmation when the atomic lifecycle effect fails technically', async () => {
    const fixture = await seed(true);
    await database.query(`
      CREATE OR REPLACE FUNCTION clinic_schema.fail_wired_patient_revision()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'controlled producer failure'; END $$
    `);
    await database.query(`
      CREATE TRIGGER fail_wired_patient_revision
      BEFORE INSERT ON clinic_schema.clinic_patient_association_revisions
      FOR EACH ROW EXECUTE FUNCTION clinic_schema.fail_wired_patient_revision()
    `);
    try {
      await expect(booking.confirmManualHold(command(fixture))).rejects.toMatchObject({
        response: { code: 'BOOKING_TEMPORARILY_UNAVAILABLE' },
      });
      const state = await producerState(fixture.holdId);
      expect(state).toMatchObject({
        hold_state: 'MANUAL_CONFIRM_PENDING',
        hold_version: 1,
        appointments: '0',
        associations: '0',
        receipts: '0',
        revisions: '0',
        association_events: '0',
        booking_confirmed_events: '0',
      });
    } finally {
      await database.query('DROP TRIGGER IF EXISTS fail_wired_patient_revision ON clinic_schema.clinic_patient_association_revisions');
      await database.query('DROP FUNCTION IF EXISTS clinic_schema.fail_wired_patient_revision()');
    }
  });
});

type Fixture = {
  holdId: string;
  employee: JwtPayload;
  clinicId: string;
  locationId: string;
  petId: string;
};

function command(fixture: Fixture, idempotencyKey = randomUUID()) {
  return {
    holdId: fixture.holdId,
    employee: fixture.employee,
    idempotencyKey,
    correlationId: randomUUID(),
    expectedVersion: 1,
  };
}

async function httpConfirm(fixture: Fixture, idempotencyKey: string) {
  const token = await jwt.signAsync(fixture.employee, {
    secret: config.jwtSecret,
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
    algorithm: 'HS256',
  });
  return request(app.getHttpServer())
    .post(`/v1/clinic/booking-holds/${fixture.holdId}/confirm`)
    .set('Authorization', `Bearer ${token}`)
    .set('Idempotency-Key', idempotencyKey)
    .set('If-Match', '1')
    .set('X-Correlation-ID', randomUUID());
}

async function seed(consent: boolean | 'EXPIRED'): Promise<Fixture> {
  await database.query('TRUNCATE clinic_schema.clinics, pet_schema.pets, identity_schema.users CASCADE');
  await database.query('TRUNCATE booking_schema.outbox_events, booking_schema.idempotency_records, audit_schema.audit_log');

  const employeeId = randomUUID();
  const ownerId = randomUUID();
  const clinicId = randomUUID();
  const locationId = randomUUID();
  const serviceId = randomUUID();
  const slotId = randomUUID();
  const petId = randomUUID();
  const holdId = randomUUID();

  await database.query('INSERT INTO identity_schema.users(id) VALUES ($1),($2)', [employeeId, ownerId]);
  await database.query(`INSERT INTO clinic_schema.clinics(id,legal_name,public_name) VALUES ($1,'Producer LLC','Producer')`, [clinicId]);
  await database.query(`INSERT INTO clinic_schema.clinic_locations(id,clinic_id,address) VALUES ($1,$2,'Producer')`, [locationId, clinicId]);
  await database.query(`
    INSERT INTO clinic_schema.employee_location_memberships(employee_id,clinic_location_id,role)
    VALUES ($1,$2,'CLINIC_RECEPTIONIST')
  `, [employeeId, locationId]);
  await database.query(`
    INSERT INTO clinic_schema.clinic_services(id,clinic_location_id,code,display_name,duration_minutes)
    VALUES ($1,$2,'PRODUCER','Producer',30)
  `, [serviceId, locationId]);
  await database.query(`INSERT INTO pet_schema.pets(id,owner_id,name,species) VALUES ($1,$2,'Private','CAT')`, [petId, ownerId]);
  await database.query(`
    INSERT INTO clinic_schema.appointment_slots(
      id,clinic_location_id,service_id,starts_at,ends_at,capacity,held_count,status,integration_mode)
    VALUES ($1,$2,$3,clock_timestamp()+interval '1 day',
      clock_timestamp()+interval '1 day 30 minutes',1,1,'LOCKED_BY_HOLD','LEVEL_C')
  `, [slotId, locationId, serviceId]);
  await database.query(`
    INSERT INTO booking_schema.booking_holds(
      id,slot_id,owner_id,pet_id,state,expires_at,confirmation_sla_expires_at)
    VALUES ($1,$2,$3,$4,'MANUAL_CONFIRM_PENDING',
      clock_timestamp()+interval '16 minutes',clock_timestamp()+interval '15 minutes')
  `, [holdId, slotId, ownerId, petId]);
  if (consent) {
    const expired = consent === 'EXPIRED';
    await database.query(`
      INSERT INTO clinic_schema.clinic_patient_consents(
        clinic_id,clinic_location_id,pet_id,subject_owner_id,purpose,
        consent_version,source,actor_type,actor_id,granted_at,expires_at)
      VALUES ($1,$2,$3,$4,'PATIENT_ADMIN_REGISTRY','producer-v1',
        'OWNER_BOOKING','OWNER',$4::uuid::text,
        clock_timestamp()-$5::interval,clock_timestamp()+$6::interval)
    `, [
      clinicId,
      locationId,
      petId,
      ownerId,
      expired ? '2 days' : '1 minute',
      expired ? '-1 day' : '1 day',
    ]);
  }
  return {
    holdId,
    clinicId,
    locationId,
    petId,
    employee: {
      sub: employeeId,
      roles: [Role.CLINIC_RECEPTIONIST],
      clinicIds: [clinicId],
      locationIds: [locationId],
    },
  };
}

async function producerState(holdId: string) {
  return (await database.query<any>(`
    SELECT hold.state hold_state, hold.version hold_version,
      (SELECT COUNT(*)::text FROM booking_schema.appointments WHERE hold_id=hold.id) appointments,
      (SELECT COUNT(*)::text FROM clinic_schema.clinic_patient_associations) associations,
      association.version association_version,
      association.pet_id::text association_pet_id,
      association.clinic_location_id::text association_location_id,
      (SELECT COUNT(*)::text FROM clinic_schema.clinic_patient_association_event_receipts) receipts,
      (SELECT source_event_id::text FROM clinic_schema.clinic_patient_association_event_receipts LIMIT 1) receipt_event_id,
      (SELECT source_aggregate_id::text FROM clinic_schema.clinic_patient_association_event_receipts LIMIT 1) receipt_appointment_id,
      (SELECT COUNT(*)::text FROM clinic_schema.clinic_patient_association_revisions) revisions,
      (SELECT COUNT(*)::text FROM booking_schema.outbox_events WHERE aggregate_type='ClinicPatientAssociation') association_events,
      (SELECT COUNT(*)::text FROM booking_schema.outbox_events WHERE event_type='booking.confirmed.v1' AND aggregate_id=hold.id) booking_confirmed_events,
      (SELECT id::text FROM booking_schema.appointment_events WHERE hold_id=hold.id AND event_type='CONFIRMED' LIMIT 1) appointment_event_id
    FROM booking_schema.booking_holds hold
    LEFT JOIN clinic_schema.clinic_patient_associations association ON true
    WHERE hold.id=$1
    LIMIT 1
  `, [holdId])).rows[0];
}
