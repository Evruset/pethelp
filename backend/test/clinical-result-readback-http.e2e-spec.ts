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
const I={owner:'c1000000-0000-4000-8000-000000000001',vet:'c1000000-0000-4000-8000-000000000002',foreignVet:'c1000000-0000-4000-8000-000000000003',admin:'c1000000-0000-4000-8000-000000000004',clinic:'c2000000-0000-4000-8000-000000000001',foreignClinic:'c2000000-0000-4000-8000-000000000002',location:'c3000000-0000-4000-8000-000000000001',foreignLocation:'c3000000-0000-4000-8000-000000000002',pet:'c4000000-0000-4000-8000-000000000001',service:'c5000000-0000-4000-8000-000000000001',slot:'c6000000-0000-4000-8000-000000000001',hold:'c7000000-0000-4000-8000-000000000001',appointment:'c8000000-0000-4000-8000-000000000001',visit:'c9000000-0000-4000-8000-000000000001'};

describe('W7-B2 canonical clinical Result readback (real PostgreSQL HTTP)',()=>{
  let app:INestApplication;let db:DatabaseService;let jwt:JwtService;
  beforeAll(async()=>{if(!new URL(config.databaseUrl).pathname.startsWith('/vethelp_w7b2_'))throw new Error('W7-B2 test requires a disposable vethelp_w7b2_* database');app=await NestFactory.create(NestRoot,{logger:false});app.useGlobalFilters(new BookingErrorFilter());await app.init();db=app.get(DatabaseService);jwt=app.get(JwtService);await seed(db);});afterAll(async()=>{await app?.close();});
  const token=(sub:string,roles:Role[],clinics:string[]=[],locations:string[]=[])=>jwt.signAsync({sub,roles,clinicIds:clinics,locationIds:locations},{secret:config.jwtSecret,issuer:config.jwtIssuer,audience:config.jwtAudience,algorithm:'HS256'});
  const vetToken=()=>token(I.vet,[Role.CLINIC_VETERINARIAN],[I.clinic],[I.location]);
  const current=async(auth?:string)=>request(app.getHttpServer()).get(`/v1/clinic/visits/${I.visit}/results`).set('Authorization',`Bearer ${auth??await vetToken()}`);
  const create=async(key:string,summary:string)=>request(app.getHttpServer()).post(`/v1/clinic/visits/${I.visit}/results`).set('Authorization',`Bearer ${await vetToken()}`).set('Idempotency-Key',key).set('X-Correlation-ID',randomUUID()).send({clinicalSummary:summary});

  it('restores no Result, unique DRAFT, PUBLISHED Result and immutable Amendments without read mutation or scope leakage',async()=>{
    expect((await current()).body).toEqual({visitId:I.visit,result:null,amendments:[]});
    const keyA=randomUUID(),keyB=randomUUID();const attempts=await Promise.all([create(keyA,'Canonical draft'),create(keyB,'Competing draft')]);expect(attempts.map(r=>r.status).sort()).toEqual([201,409]);
    const winner=attempts.find(r=>r.status===201)!;const winnerKey=winner===attempts[0]?keyA:keyB;const resultId=winner.body.id as string;
    const replay=await create(winnerKey,'Canonical draft');expect(replay.status).toBe(201);expect(replay.body.id).toBe(resultId);
    const conflict=attempts.find(r=>r.status===409)!;expect(conflict.body).toMatchObject({code:'CLINICAL_RESULT_ALREADY_EXISTS',currentResult:{id:resultId,status:'DRAFT'}});
    expect((await db.query(`SELECT count(*)::int count FROM clinical_schema.visit_results WHERE visit_id=$1`,[I.visit])).rows[0].count).toBe(1);
    expect((await db.query(`SELECT count(*)::int count FROM audit_schema.audit_log WHERE action='clinical.result.draft.created' AND aggregate_id=$1`,[resultId])).rows[0].count).toBe(1);
    expect((await db.query(`SELECT count(*)::int count FROM booking_schema.outbox_events WHERE event_type='clinical.result.draft.created' AND aggregate_id=$1`,[resultId])).rows[0].count).toBe(1);
    expect((await current()).body).toMatchObject({visitId:I.visit,result:{id:resultId,status:'DRAFT',clinicalSummary:'Canonical draft'},amendments:[]});

    const published=await request(app.getHttpServer()).post(`/v1/clinic/visits/${I.visit}/results/${resultId}/publish`).set('Authorization',`Bearer ${await vetToken()}`).set('X-Correlation-ID',randomUUID());expect(published.status).toBe(200);
    const amendmentIds:string[]=[];for(const content of ['First correction','Second correction']){const response=await request(app.getHttpServer()).post(`/v1/clinic/visits/${I.visit}/results/${resultId}/amendments`).set('Authorization',`Bearer ${await vetToken()}`).set('Idempotency-Key',randomUUID()).set('X-Correlation-ID',randomUUID()).send({content});expect(response.status).toBe(201);amendmentIds.push(response.body.id);}
    const before=await snapshot(db,resultId);const read=await current();expect(read.status).toBe(200);expect(read.body).toMatchObject({visitId:I.visit,result:{id:resultId,status:'PUBLISHED',clinicalSummary:'Canonical draft'},amendments:[{amendmentId:amendmentIds[0],content:'First correction'},{amendmentId:amendmentIds[1],content:'Second correction'}]});expect(await snapshot(db,resultId)).toEqual(before);
    expect((await current(await token(I.foreignVet,[Role.CLINIC_VETERINARIAN],[I.foreignClinic],[I.foreignLocation]))).status).toBe(403);
    expect((await current(await token(I.vet,[Role.CLINIC_VETERINARIAN],[I.clinic],[I.foreignLocation]))).status).toBe(403);
    expect((await current(await token(I.admin,[Role.CLINIC_ADMIN],[I.clinic],[I.location]))).status).toBe(403);
  });
});

async function snapshot(db:DatabaseService,resultId:string){return(await db.query(`SELECT (SELECT row_to_json(r) FROM clinical_schema.visit_results r WHERE id=$1) result,(SELECT json_agg(row_to_json(a) ORDER BY created_at,id) FROM clinical_schema.visit_result_amendments a WHERE result_id=$1) amendments,(SELECT count(*)::int FROM clinical_schema.diary_entries WHERE source_result_id=$1 OR source_amendment_id IN(SELECT id FROM clinical_schema.visit_result_amendments WHERE result_id=$1)) diary,(SELECT count(*)::int FROM audit_schema.audit_log WHERE aggregate_id=$1 OR aggregate_id IN(SELECT id FROM clinical_schema.visit_result_amendments WHERE result_id=$1)) audit,(SELECT count(*)::int FROM booking_schema.outbox_events WHERE aggregate_id=$1 OR aggregate_id IN(SELECT id FROM clinical_schema.visit_result_amendments WHERE result_id=$1)) outbox`,[resultId])).rows[0];}
async function seed(db:DatabaseService){await db.query(`INSERT INTO identity_schema.users(id) VALUES('${I.owner}'),('${I.vet}'),('${I.foreignVet}'),('${I.admin}');INSERT INTO clinic_schema.clinics(id,legal_name,public_name) VALUES('${I.clinic}','Clinic','Clinic'),('${I.foreignClinic}','Foreign','Foreign');INSERT INTO clinic_schema.clinic_locations(id,clinic_id,address) VALUES('${I.location}','${I.clinic}','A'),('${I.foreignLocation}','${I.foreignClinic}','B');INSERT INTO clinic_schema.employee_location_memberships(employee_id,clinic_location_id,role) VALUES('${I.vet}','${I.location}','CLINIC_VETERINARIAN'),('${I.admin}','${I.location}','CLINIC_ADMIN'),('${I.foreignVet}','${I.foreignLocation}','CLINIC_VETERINARIAN');INSERT INTO clinic_schema.clinic_services(id,clinic_location_id,code,display_name,duration_minutes) VALUES('${I.service}','${I.location}','S','Service',30);INSERT INTO clinic_schema.appointment_slots(id,clinic_location_id,service_id,starts_at,ends_at) VALUES('${I.slot}','${I.location}','${I.service}',clock_timestamp()-interval '1 hour',clock_timestamp());INSERT INTO pet_schema.pets(id,owner_id,name,species) VALUES('${I.pet}','${I.owner}','Pet','DOG');INSERT INTO booking_schema.booking_holds(id,slot_id,owner_id,pet_id,state,expires_at) VALUES('${I.hold}','${I.slot}','${I.owner}','${I.pet}','COMPLETED',clock_timestamp()+interval '1 hour');INSERT INTO booking_schema.appointments(id,hold_id,owner_id,pet_id,clinic_location_id,slot_id,status) VALUES('${I.appointment}','${I.hold}','${I.owner}','${I.pet}','${I.location}','${I.slot}','COMPLETED');INSERT INTO clinical_schema.visits(id,appointment_id,booking_hold_id,owner_id,pet_id,clinic_id,location_id,slot_id,completed_by) VALUES('${I.visit}','${I.appointment}','${I.hold}','${I.owner}','${I.pet}','${I.clinic}','${I.location}','${I.slot}','${I.vet}')`);}
