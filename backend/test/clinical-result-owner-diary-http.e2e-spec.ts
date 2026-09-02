import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { Role } from '../src/auth/auth.types';
import { BookingErrorFilter } from '../src/common/booking-error.filter';
import { config } from '../src/config';
import { DatabaseService } from '../src/database/database.service';
import { NestRoot } from '../src/nest-root-full';

jest.setTimeout(90_000);

const I = {
  owner: 'a1000000-0000-4000-8000-000000000001', otherOwner: 'a1000000-0000-4000-8000-000000000002',
  vet: 'a1000000-0000-4000-8000-000000000003', foreignVet: 'a1000000-0000-4000-8000-000000000004', admin: 'a1000000-0000-4000-8000-000000000005',
  clinic: 'a2000000-0000-4000-8000-000000000001', foreignClinic: 'a2000000-0000-4000-8000-000000000002',
  location: 'a3000000-0000-4000-8000-000000000001', foreignLocation: 'a3000000-0000-4000-8000-000000000002',
  pet: 'a4000000-0000-4000-8000-000000000001', unrelatedPet: 'a4000000-0000-4000-8000-000000000002',
  service: 'a5000000-0000-4000-8000-000000000001', slot: 'a6000000-0000-4000-8000-000000000001',
  hold: 'a7000000-0000-4000-8000-000000000001', appointment: 'a8000000-0000-4000-8000-000000000001', visit: 'a9000000-0000-4000-8000-000000000001',
};

describe('W7-A Result lifecycle and Owner diary HTTP closure (real PostgreSQL)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let jwt: JwtService;

  beforeAll(async () => {
    if (!new URL(config.databaseUrl).pathname.startsWith('/vethelp_w7a5r_')) throw new Error('W7-A5R test requires a disposable vethelp_w7a5r_* database');
    app = await NestFactory.create(NestRoot, { logger: false });
    app.useGlobalFilters(new BookingErrorFilter());
    await app.init();
    db = app.get(DatabaseService);
    jwt = app.get(JwtService);
    await seed(db);
  });
  afterAll(async () => { await app?.close(); });

  const token = (sub: string, roles: Role[], clinicIds: string[] = [], locationIds: string[] = []) => jwt.signAsync(
    { sub, roles, clinicIds, locationIds },
    { secret: config.jwtSecret, issuer: config.jwtIssuer, audience: config.jwtAudience, algorithm: 'HS256' },
  );
  const clinicToken = () => token(I.vet, [Role.CLINIC_VETERINARIAN], [I.clinic], [I.location]);
  const ownerToken = (owner = I.owner) => token(owner, [Role.OWNER]);

  it('enforces exact clinic scope and exposes only published owner-bound diary sources with one publication event pair', async () => {
    const create = (authorization: string) => request(app.getHttpServer())
      .post(`/v1/clinic/visits/${I.visit}/results`)
      .set('Authorization', `Bearer ${authorization}`)
      .set('Idempotency-Key', randomUUID()).set('X-Correlation-ID', randomUUID())
      .send({ clinicalSummary: 'Published owner-visible result' });

    expect((await create(await token(I.foreignVet, [Role.CLINIC_VETERINARIAN], [I.foreignClinic], [I.foreignLocation]))).status).toBe(403);
    expect((await create(await token(I.vet, [Role.CLINIC_VETERINARIAN], [I.clinic], [I.foreignLocation]))).status).toBe(403);
    expect((await create(await token(I.admin, [Role.CLINIC_ADMIN], [I.clinic], [I.location]))).status).toBe(403);

    const created = await create(await clinicToken());
    expect(created.status).toBe(201);
    const resultId = created.body.id as string;

    const diary = async (petId: string, owner = I.owner) => request(app.getHttpServer())
      .get(`/v1/owner/pets/${petId}/diary`).set('Authorization', `Bearer ${await ownerToken(owner)}`);
    const draftDiary = await diary(I.pet);
    if (draftDiary.status !== 200) throw new Error(`Unexpected Owner diary response ${draftDiary.status}: ${JSON.stringify(draftDiary.body)}`);
    expect(draftDiary.body.entries.filter((entry: { type: string }) => entry.type === 'RESULT')).toEqual([]);

    const publish = async () => request(app.getHttpServer())
      .post(`/v1/clinic/visits/${I.visit}/results/${resultId}/publish`)
      .set('Authorization', `Bearer ${await clinicToken()}`).set('X-Correlation-ID', randomUUID());
    expect((await publish()).status).toBe(200);
    expect((await publish()).status).toBe(200);

    const amendment = await request(app.getHttpServer())
      .post(`/v1/clinic/visits/${I.visit}/results/${resultId}/amendments`)
      .set('Authorization', `Bearer ${await clinicToken()}`)
      .set('Idempotency-Key', randomUUID()).set('X-Correlation-ID', randomUUID())
      .send({ content: 'Published owner-visible correction' });
    expect(amendment.status).toBe(201);

    const owned = await diary(I.pet);
    expect(owned.status).toBe(200);
    expect(owned.body.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'RESULT', sourceId: resultId, summary: 'Published owner-visible result', lifecycleStatus: 'PUBLISHED' }),
      expect.objectContaining({ type: 'RESULT_AMENDMENT', sourceId: amendment.body.id, summary: 'Published owner-visible correction', lifecycleStatus: 'PUBLISHED' }),
    ]));
    expect(owned.body.clinicalEntries).toEqual([{
      visit: expect.objectContaining({ visitId: I.visit, clinic: { name: 'Clinic' } }),
      result: expect.objectContaining({ resultId, content: 'Published owner-visible result' }),
      amendments: [expect.objectContaining({ amendmentId: amendment.body.id, content: 'Published owner-visible correction' })],
    }]);
    expect((await diary(I.pet, I.otherOwner)).status).toBe(404);
    expect((await diary(I.unrelatedPet)).body.entries.filter((entry: { type: string }) => entry.type.startsWith('RESULT'))).toEqual([]);

    expect((await db.query(`SELECT count(*)::int count FROM audit_schema.audit_log WHERE action='clinical.result.published' AND aggregate_id=$1`, [resultId])).rows[0].count).toBe(1);
    expect((await db.query(`SELECT count(*)::int count FROM booking_schema.outbox_events WHERE event_type='clinical.result.published' AND aggregate_id=$1`, [resultId])).rows[0].count).toBe(1);
  });
});

async function seed(db: DatabaseService) { await db.query(`
  INSERT INTO identity_schema.users(id) VALUES('${I.owner}'),('${I.otherOwner}'),('${I.vet}'),('${I.foreignVet}'),('${I.admin}');
  INSERT INTO clinic_schema.clinics(id,legal_name,public_name) VALUES('${I.clinic}','Clinic','Clinic'),('${I.foreignClinic}','Foreign','Foreign');
  INSERT INTO clinic_schema.clinic_locations(id,clinic_id,address,timezone) VALUES('${I.location}','${I.clinic}','A','Europe/Moscow'),('${I.foreignLocation}','${I.foreignClinic}','B','Europe/Moscow');
  INSERT INTO clinic_schema.employee_location_memberships(employee_id,clinic_location_id,role) VALUES('${I.vet}','${I.location}','CLINIC_VETERINARIAN'),('${I.admin}','${I.location}','CLINIC_ADMIN'),('${I.foreignVet}','${I.foreignLocation}','CLINIC_VETERINARIAN');
  INSERT INTO clinic_schema.clinic_services(id,clinic_location_id,code,display_name,duration_minutes) VALUES('${I.service}','${I.location}','S','Service',30);
  INSERT INTO clinic_schema.appointment_slots(id,clinic_location_id,service_id,starts_at,ends_at) VALUES('${I.slot}','${I.location}','${I.service}',clock_timestamp()-interval '1 hour',clock_timestamp());
  INSERT INTO pet_schema.pets(id,owner_id,name,species) VALUES('${I.pet}','${I.owner}','Pet','DOG'),('${I.unrelatedPet}','${I.owner}','Other','CAT');
  INSERT INTO booking_schema.booking_holds(id,slot_id,owner_id,pet_id,state,expires_at) VALUES('${I.hold}','${I.slot}','${I.owner}','${I.pet}','COMPLETED',clock_timestamp()+interval '1 hour');
  INSERT INTO booking_schema.appointments(id,hold_id,owner_id,pet_id,clinic_location_id,slot_id,status) VALUES('${I.appointment}','${I.hold}','${I.owner}','${I.pet}','${I.location}','${I.slot}','COMPLETED');
  INSERT INTO clinical_schema.visits(id,appointment_id,booking_hold_id,owner_id,pet_id,clinic_id,location_id,slot_id,completed_by) VALUES('${I.visit}','${I.appointment}','${I.hold}','${I.owner}','${I.pet}','${I.clinic}','${I.location}','${I.slot}','${I.vet}');
`); }
