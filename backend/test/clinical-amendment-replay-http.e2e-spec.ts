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

const I={owner:'91000000-0000-4000-8000-000000000001',vet:'91000000-0000-4000-8000-000000000002',clinic:'92000000-0000-4000-8000-000000000001',location:'93000000-0000-4000-8000-000000000001',pet:'94000000-0000-4000-8000-000000000001',service:'95000000-0000-4000-8000-000000000001',slot:'96000000-0000-4000-8000-000000000001',hold:'97000000-0000-4000-8000-000000000001',appointment:'98000000-0000-4000-8000-000000000001',visit:'99000000-0000-4000-8000-000000000001',result:'99000000-0000-4000-8000-000000000002'};

describe('W7-A6 immutable Amendment idempotent replay (real PostgreSQL HTTP)',()=>{
  let app:INestApplication;let db:DatabaseService;let jwt:JwtService;
  beforeAll(async()=>{if(!new URL(config.databaseUrl).pathname.startsWith('/vethelp_w7a6_'))throw new Error('W7-A6 test requires a disposable vethelp_w7a6_* database');app=await NestFactory.create(NestRoot,{logger:false});app.useGlobalFilters(new BookingErrorFilter());await app.init();db=app.get(DatabaseService);jwt=app.get(JwtService);await seed(db);});
  afterAll(async()=>{await app?.close();});
  const token=()=>jwt.signAsync({sub:I.vet,roles:[Role.CLINIC_VETERINARIAN],clinicIds:[I.clinic],locationIds:[I.location]},{secret:config.jwtSecret,issuer:config.jwtIssuer,audience:config.jwtAudience,algorithm:'HS256'});
  const amend=async(key:string,content='Authoritative correction')=>request(app.getHttpServer()).post(`/v1/clinic/visits/${I.visit}/results/${I.result}/amendments`).set('Authorization',`Bearer ${await token()}`).set('Idempotency-Key',key).set('X-Correlation-ID',randomUUID()).send({content});

  it('replays by immutable readback without duplicate row, projection, audit or outbox',async()=>{
    const key=randomUUID();const first=await amend(key);expect(first.status).toBe(201);expect(first.body).toMatchObject({resultId:I.result,visitId:I.visit,content:'Authoritative correction'});
    const amendmentId=first.body.id as string;
    const before=(await db.query(`SELECT id::text,result_id::text,visit_id::text,owner_id::text,pet_id::text,clinic_id::text,location_id::text,author_id::text,amendment_content,idempotency_key::text,created_at,published_at FROM clinical_schema.visit_result_amendments WHERE id=$1`,[amendmentId])).rows[0];

    const replay=await amend(key);expect(replay.status).toBe(201);expect(replay.body).toEqual(first.body);
    const after=(await db.query(`SELECT id::text,result_id::text,visit_id::text,owner_id::text,pet_id::text,clinic_id::text,location_id::text,author_id::text,amendment_content,idempotency_key::text,created_at,published_at FROM clinical_schema.visit_result_amendments WHERE id=$1`,[amendmentId])).rows[0];
    expect(after).toEqual(before);
    expect((await db.query(`SELECT count(*)::int count FROM clinical_schema.visit_result_amendments WHERE result_id=$1 AND idempotency_key=$2`,[I.result,key])).rows[0].count).toBe(1);
    expect((await db.query(`SELECT count(*)::int count FROM clinical_schema.diary_entries WHERE source_amendment_id=$1`,[amendmentId])).rows[0].count).toBe(1);
    expect((await db.query(`SELECT count(*)::int count FROM audit_schema.audit_log WHERE action='clinical.result.amendment.published' AND aggregate_id=$1`,[amendmentId])).rows[0].count).toBe(1);
    expect((await db.query(`SELECT count(*)::int count FROM booking_schema.outbox_events WHERE event_type='clinical.result.amendment.published' AND aggregate_id=$1`,[amendmentId])).rows[0].count).toBe(1);

    const conflicting=await amend(key,'Conflicting correction');expect(conflicting.status).toBe(409);expect((await db.query(`SELECT amendment_content FROM clinical_schema.visit_result_amendments WHERE id=$1`,[amendmentId])).rows[0].amendment_content).toBe('Authoritative correction');
  });
});

async function seed(db:DatabaseService){await db.query(`
 INSERT INTO identity_schema.users(id) VALUES('${I.owner}'),('${I.vet}');
 INSERT INTO clinic_schema.clinics(id,legal_name,public_name) VALUES('${I.clinic}','Clinic','Clinic');
 INSERT INTO clinic_schema.clinic_locations(id,clinic_id,address) VALUES('${I.location}','${I.clinic}','A');
 INSERT INTO clinic_schema.employee_location_memberships(employee_id,clinic_location_id,role) VALUES('${I.vet}','${I.location}','CLINIC_VETERINARIAN');
 INSERT INTO clinic_schema.clinic_services(id,clinic_location_id,code,display_name,duration_minutes) VALUES('${I.service}','${I.location}','S','Service',30);
 INSERT INTO clinic_schema.appointment_slots(id,clinic_location_id,service_id,starts_at,ends_at) VALUES('${I.slot}','${I.location}','${I.service}',clock_timestamp()-interval '1 hour',clock_timestamp());
 INSERT INTO pet_schema.pets(id,owner_id,name,species) VALUES('${I.pet}','${I.owner}','Pet','DOG');
 INSERT INTO booking_schema.booking_holds(id,slot_id,owner_id,pet_id,state,expires_at) VALUES('${I.hold}','${I.slot}','${I.owner}','${I.pet}','COMPLETED',clock_timestamp()+interval '1 hour');
 INSERT INTO booking_schema.appointments(id,hold_id,owner_id,pet_id,clinic_location_id,slot_id,status) VALUES('${I.appointment}','${I.hold}','${I.owner}','${I.pet}','${I.location}','${I.slot}','COMPLETED');
 INSERT INTO clinical_schema.visits(id,appointment_id,booking_hold_id,owner_id,pet_id,clinic_id,location_id,slot_id,completed_by) VALUES('${I.visit}','${I.appointment}','${I.hold}','${I.owner}','${I.pet}','${I.clinic}','${I.location}','${I.slot}','${I.vet}');
 BEGIN;
 INSERT INTO clinical_schema.visit_results(id,visit_id,owner_id,pet_id,clinic_id,location_id,author_id,status,clinical_summary,idempotency_key,published_at) VALUES('${I.result}','${I.visit}','${I.owner}','${I.pet}','${I.clinic}','${I.location}','${I.vet}','PUBLISHED','Published result',gen_random_uuid(),clock_timestamp());
 INSERT INTO clinical_schema.diary_entries(owner_id,pet_id,visit_id,source_result_id,occurred_at) SELECT owner_id,pet_id,visit_id,id,published_at FROM clinical_schema.visit_results WHERE id='${I.result}';
 COMMIT;
`);}
