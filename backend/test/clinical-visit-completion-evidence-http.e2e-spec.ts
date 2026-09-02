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
  owner:'81000000-0000-4000-8000-000000000001', vet:'81000000-0000-4000-8000-000000000002', foreignVet:'81000000-0000-4000-8000-000000000003', admin:'81000000-0000-4000-8000-000000000004',
  clinic:'82000000-0000-4000-8000-000000000001', foreignClinic:'82000000-0000-4000-8000-000000000002', location:'83000000-0000-4000-8000-000000000001', foreignLocation:'83000000-0000-4000-8000-000000000002',
  pet:'84000000-0000-4000-8000-000000000001', service:'85000000-0000-4000-8000-000000000001', invalidService:'85000000-0000-4000-8000-000000000002',
  slot:'86000000-0000-4000-8000-000000000001', invalidSlot:'86000000-0000-4000-8000-000000000002', hold:'87000000-0000-4000-8000-000000000001', invalidHold:'87000000-0000-4000-8000-000000000002',
  appointment:'88000000-0000-4000-8000-000000000001', invalidAppointment:'88000000-0000-4000-8000-000000000002',
};

describe('W7-A4 Visit completion evidence HTTP contract (real PostgreSQL)', () => {
  let app:INestApplication;let db:DatabaseService;let jwt:JwtService;
  beforeAll(async()=>{if(!new URL(config.databaseUrl).pathname.startsWith('/vethelp_w7a4_'))throw new Error('W7-A4 HTTP test requires a disposable vethelp_w7a4_* database');app=await NestFactory.create(NestRoot,{logger:false});app.useGlobalFilters(new BookingErrorFilter());await app.init();db=app.get(DatabaseService);jwt=app.get(JwtService);await seed(db);});
  afterAll(async()=>{await app?.close();});
  const token=(sub:string,roles:Role[],clinicIds:string[],locationIds:string[])=>jwt.signAsync({sub,roles,clinicIds,locationIds},{secret:config.jwtSecret,issuer:config.jwtIssuer,audience:config.jwtAudience,algorithm:'HS256'});
  const complete=async(holdId:string,sub=I.vet,roles=[Role.CLINIC_VETERINARIAN],clinics=[I.clinic],locations=[I.location])=>request(app.getHttpServer()).post(`/v1/clinic/booking-holds/${holdId}/complete`).set('Authorization',`Bearer ${await token(sub,roles,clinics,locations)}`).set('X-Correlation-ID',randomUUID()).send({summary:'Bounded clinical summary without sensitive event payload'});

  it('commits exactly one visit-keyed clinical audit/outbox pair across replay and rejects failed/foreign attempts without evidence',async()=>{
    const first=await complete(I.hold);expect(first.status).toBe(200);expect(first.body.visitId).toMatch(/^[0-9a-f-]{36}$/i);
    const visitId=first.body.visitId;
    expect((await db.query(`SELECT count(*)::int count FROM clinical_schema.visits WHERE id=$1 AND appointment_id=$2 AND booking_hold_id=$3`,[visitId,I.appointment,I.hold])).rows[0].count).toBe(1);
    await expectEvidence(db,visitId,1);

    const replay=await complete(I.hold);expect(replay.status).toBe(200);expect(replay.body.visitId).toBe(visitId);
    const concurrent=await Promise.all(Array.from({length:4},()=>complete(I.hold)));
    const concurrentStatuses=concurrent.map(response=>response.status);
    if(!concurrentStatuses.every(status=>status===200||status===409))throw new Error(`Unexpected completion retry statuses: ${concurrentStatuses.join(',')}`);
    const finalReplay=await complete(I.hold);expect(finalReplay.status).toBe(200);expect(finalReplay.body.visitId).toBe(visitId);await expectEvidence(db,visitId,1);

    const event=(await db.query<{payload_json:Record<string,unknown>}>(`SELECT payload_json FROM booking_schema.outbox_events WHERE event_type='clinical.visit.completed' AND aggregate_id=$1`,[visitId])).rows[0];
    expect(event.payload_json).toEqual(expect.objectContaining({visitId,appointmentId:I.appointment,bookingHoldId:I.hold,clinicId:I.clinic,locationId:I.location,completedAt:expect.any(String)}));
    expect(JSON.stringify(event.payload_json)).not.toContain('Bounded clinical summary');
    expect((await db.query(`SELECT count(*)::int count FROM booking_schema.outbox_events WHERE event_type='notification.push.summary_ready.v1' AND aggregate_id=$1`,[I.hold])).rows[0].count).toBe(1);

    const invalid=await complete(I.invalidHold);expect(invalid.status).toBe(422);
    const foreign=await complete(I.hold,I.foreignVet,[Role.CLINIC_VETERINARIAN],[I.foreignClinic],[I.foreignLocation]);expect(foreign.status).toBe(403);
    const wrongClinicClaim=await complete(I.hold,I.vet,[Role.CLINIC_VETERINARIAN],[I.foreignClinic],[I.location]);expect(wrongClinicClaim.status).toBe(403);
    const insufficient=await complete(I.hold,I.admin,[Role.CLINIC_ADMIN],[I.clinic],[I.location]);expect(insufficient.status).toBe(403);
    expect((await db.query(`SELECT count(*)::int count FROM booking_schema.outbox_events WHERE event_type='clinical.visit.completed'`)).rows[0].count).toBe(1);
    expect((await db.query(`SELECT count(*)::int count FROM audit_schema.audit_log WHERE action='clinical.visit.completed'`)).rows[0].count).toBe(1);
    expect((await db.query(`SELECT count(*)::int count FROM clinical_schema.visits WHERE booking_hold_id=$1`,[I.invalidHold])).rows[0].count).toBe(0);
  });
});

async function expectEvidence(db:DatabaseService,visitId:string,count:number){expect((await db.query(`SELECT count(*)::int count FROM audit_schema.audit_log WHERE action='clinical.visit.completed' AND aggregate_type='clinical_visit' AND aggregate_id=$1`,[visitId])).rows[0].count).toBe(count);expect((await db.query(`SELECT count(*)::int count FROM booking_schema.outbox_events WHERE event_type='clinical.visit.completed' AND aggregate_type='clinical_visit' AND aggregate_id=$1`,[visitId])).rows[0].count).toBe(count);}

async function seed(db:DatabaseService){await db.query(`
 INSERT INTO identity_schema.users(id) VALUES('${I.owner}'),('${I.vet}'),('${I.foreignVet}'),('${I.admin}');
 INSERT INTO clinic_schema.clinics(id,legal_name,public_name) VALUES('${I.clinic}','Clinic','Clinic'),('${I.foreignClinic}','Foreign','Foreign');
 INSERT INTO clinic_schema.clinic_locations(id,clinic_id,address,timezone) VALUES('${I.location}','${I.clinic}','A','Europe/Moscow'),('${I.foreignLocation}','${I.foreignClinic}','B','Europe/Moscow');
 INSERT INTO clinic_schema.employee_location_memberships(employee_id,clinic_location_id,role) VALUES('${I.vet}','${I.location}','CLINIC_VETERINARIAN'),('${I.admin}','${I.location}','CLINIC_ADMIN'),('${I.foreignVet}','${I.foreignLocation}','CLINIC_VETERINARIAN');
 INSERT INTO clinic_schema.clinic_services(id,clinic_location_id,code,display_name,duration_minutes) VALUES('${I.service}','${I.location}','S','Service',30),('${I.invalidService}','${I.location}','I','Invalid',30);
 INSERT INTO clinic_schema.appointment_slots(id,clinic_location_id,service_id,starts_at,ends_at) VALUES('${I.slot}','${I.location}','${I.service}',clock_timestamp()-interval '1 hour',clock_timestamp()),('${I.invalidSlot}','${I.location}','${I.invalidService}',clock_timestamp()+interval '1 hour',clock_timestamp()+interval '2 hour');
 INSERT INTO pet_schema.pets(id,owner_id,name,species) VALUES('${I.pet}','${I.owner}','Pet','DOG');
 INSERT INTO booking_schema.booking_holds(id,slot_id,owner_id,pet_id,state,expires_at) VALUES('${I.hold}','${I.slot}','${I.owner}','${I.pet}','CONFIRMED',clock_timestamp()+interval '1 hour'),('${I.invalidHold}','${I.invalidSlot}','${I.owner}','${I.pet}','MANUAL_CONFIRM_PENDING',clock_timestamp()+interval '1 hour');
 INSERT INTO booking_schema.appointments(id,hold_id,owner_id,pet_id,clinic_location_id,slot_id,status) VALUES('${I.appointment}','${I.hold}','${I.owner}','${I.pet}','${I.location}','${I.slot}','CONFIRMED'),('${I.invalidAppointment}','${I.invalidHold}','${I.owner}','${I.pet}','${I.location}','${I.invalidSlot}','CONFIRMED');
`);}
