import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
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
  raceSlot:'86000000-0000-4000-8000-000000000003',raceHold:'87000000-0000-4000-8000-000000000003',raceAppointment:'88000000-0000-4000-8000-000000000003',
};

describe('Wave 3 Visit completion HTTP contract (real PostgreSQL)', () => {
  let app:INestApplication;let db:DatabaseService;let jwt:JwtService;
  beforeAll(async()=>{if(!new URL(config.databaseUrl).pathname.startsWith('/vethelp_wave3_'))throw new Error('Wave 3 HTTP test requires a disposable vethelp_wave3_* database');app=await NestFactory.create(NestRoot,{logger:false});app.useGlobalFilters(new BookingErrorFilter());await app.init();db=app.get(DatabaseService);jwt=app.get(JwtService);await seed(db);});
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
    expect((await db.query(`SELECT count(*)::int count FROM booking_schema.outbox_events WHERE event_type='notification.push.summary_ready.v1' AND aggregate_id=$1`,[I.hold])).rows[0].count).toBe(0);

    const invalid=await complete(I.invalidHold);expect(invalid.status).toBe(422);
    await db.query("UPDATE booking_schema.booking_holds SET state='CONFIRMED' WHERE id=$1",[I.invalidHold]);
    for(const [status,lifecycle] of [['NO_SHOW','NO_SHOW'],['CANCELLED','CANCELLED_BY_USER'],['CONFIRMED','RESCHEDULE_PROPOSED']] as const){
      await db.query('UPDATE booking_schema.appointments SET status=$2,lifecycle_state=$3 WHERE id=$1',[I.invalidAppointment,status,lifecycle]);
      expect((await complete(I.invalidHold)).status).toBe(422);
    }
    await db.query("UPDATE booking_schema.appointments SET status='CONFIRMED',lifecycle_state='CONFIRMED' WHERE id=$1",[I.invalidAppointment]);
    await db.query("UPDATE clinic_schema.clinics SET status='INACTIVE' WHERE id=$1",[I.clinic]);
    expect((await complete(I.invalidHold)).status).toBe(403);
    await db.query("UPDATE clinic_schema.clinics SET status='ACTIVE' WHERE id=$1",[I.clinic]);
    await db.query("UPDATE clinic_schema.clinic_locations SET status='INACTIVE' WHERE id=$1",[I.location]);
    expect((await complete(I.invalidHold)).status).toBe(403);
    await db.query("UPDATE clinic_schema.clinic_locations SET status='ACTIVE' WHERE id=$1",[I.location]);
    const foreign=await complete(I.hold,I.foreignVet,[Role.CLINIC_VETERINARIAN],[I.foreignClinic],[I.foreignLocation]);expect(foreign.status).toBe(403);
    const wrongClinicClaim=await complete(I.hold,I.vet,[Role.CLINIC_VETERINARIAN],[I.foreignClinic],[I.location]);expect(wrongClinicClaim.status).toBe(403);
    const insufficient=await complete(I.hold,I.admin,[Role.CLINIC_ADMIN],[I.clinic],[I.location]);expect(insufficient.status).toBe(403);
    expect((await db.query(`SELECT count(*)::int count FROM booking_schema.outbox_events WHERE event_type='clinical.visit.completed'`)).rows[0].count).toBe(1);
    expect((await db.query(`SELECT count(*)::int count FROM audit_schema.audit_log WHERE action='clinical.visit.completed'`)).rows[0].count).toBe(1);
    expect((await db.query(`SELECT count(*)::int count FROM clinical_schema.visits WHERE booking_hold_id=$1`,[I.invalidHold])).rows[0].count).toBe(0);
  });

  it.each([['clinic','clinic_schema.clinics',I.clinic],['location','clinic_schema.clinic_locations',I.location]] as const)('serializes completion when %s deactivation wins first',async(_label,table,id)=>{
    const deactivator=new Client({connectionString:config.databaseUrl});const observer=new Client({connectionString:config.databaseUrl});await deactivator.connect();await observer.connect();
    try{const before=(await db.query(`SELECT (SELECT count(*) FROM audit_schema.audit_log WHERE aggregate_id=$1)::int audit,(SELECT count(*) FROM booking_schema.outbox_events WHERE aggregate_id=$1)::int outbox`,[I.invalidHold])).rows[0];await deactivator.query('BEGIN');await deactivator.query(`UPDATE ${table} SET status='INACTIVE' WHERE id=$1`,[id]);const attempt=complete(I.invalidHold).then(response=>response);await waitForBlockedAuthority(observer);await deactivator.query('COMMIT');const response=await attempt;expect(response.status).toBe(403);expect((await db.query(`SELECT state FROM booking_schema.booking_holds WHERE id=$1`,[I.invalidHold])).rows[0].state).toBe('CONFIRMED');expect((await db.query(`SELECT status,lifecycle_state FROM booking_schema.appointments WHERE id=$1`,[I.invalidAppointment])).rows[0]).toEqual({status:'CONFIRMED',lifecycle_state:'CONFIRMED'});expect((await db.query(`SELECT count(*)::int count FROM clinical_schema.visits WHERE booking_hold_id=$1`,[I.invalidHold])).rows[0].count).toBe(0);expect((await db.query(`SELECT (SELECT count(*) FROM audit_schema.audit_log WHERE aggregate_id=$1)::int audit,(SELECT count(*) FROM booking_schema.outbox_events WHERE aggregate_id=$1)::int outbox`,[I.invalidHold])).rows[0]).toEqual(before);}finally{await deactivator.query('ROLLBACK').catch(()=>undefined);await deactivator.query(`UPDATE ${table} SET status='ACTIVE' WHERE id=$1`,[id]).catch(()=>undefined);await deactivator.end();await observer.end();}
  });

  it.each([['clinic','clinic_schema.clinics',I.clinic,I.invalidHold],['location','clinic_schema.clinic_locations',I.location,I.raceHold]] as const)('holds %s authority until completion commits',async(_label,table,id,holdId)=>{
    const observer=new Client({connectionString:config.databaseUrl});const deactivator=new Client({connectionString:config.databaseUrl});await observer.connect();await deactivator.connect();
    try{await deactivator.query(`UPDATE ${table} SET status='ACTIVE' WHERE id=$1`,[id]);await db.query(`CREATE OR REPLACE FUNCTION clinical_schema.wave3_authority_race_probe() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(0.035);RETURN NEW;END $$;CREATE TRIGGER wave3_authority_race_probe BEFORE UPDATE OF state ON booking_schema.booking_holds FOR EACH ROW WHEN(NEW.state='COMPLETED') EXECUTE FUNCTION clinical_schema.wave3_authority_race_probe()`);const attempt=complete(holdId).then(response=>response);await waitForRaceProbe(observer);await deactivator.query('BEGIN');await deactivator.query(`SET LOCAL lock_timeout='5ms'`);await expect(deactivator.query(`UPDATE ${table} SET status='INACTIVE' WHERE id=$1`,[id])).rejects.toMatchObject({code:'55P03'});await deactivator.query('ROLLBACK');const response=await attempt;expect(response.status).toBe(200);expect((await db.query(`SELECT count(*)::int count FROM clinical_schema.visits WHERE booking_hold_id=$1`,[holdId])).rows[0].count).toBe(1);await deactivator.query(`UPDATE ${table} SET status='INACTIVE' WHERE id=$1`,[id]);await deactivator.query(`UPDATE ${table} SET status='ACTIVE' WHERE id=$1`,[id]);}finally{await deactivator.query('ROLLBACK').catch(()=>undefined);await db.query('DROP TRIGGER IF EXISTS wave3_authority_race_probe ON booking_schema.booking_holds;DROP FUNCTION IF EXISTS clinical_schema.wave3_authority_race_probe()').catch(()=>undefined);await deactivator.query(`UPDATE ${table} SET status='ACTIVE' WHERE id=$1`,[id]).catch(()=>undefined);await observer.end();await deactivator.end();}
  });
});

async function waitForBlockedAuthority(observer:Client){await waitForBlocked(observer,"%transaction_timestamp() AS server_now%");}
async function waitForBlocked(observer:Client,pattern:string){for(let attempt=0;attempt<100;attempt++){const waiting=(await observer.query(`SELECT count(*)::int count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE $1`,[pattern])).rows[0].count;if(waiting>0)return;await new Promise(resolve=>setTimeout(resolve,20));}throw new Error(`Timed out waiting for PostgreSQL lock: ${pattern}`);}
async function waitForRaceProbe(observer:Client){for(let attempt=0;attempt<100;attempt++){const active=(await observer.query(`SELECT count(*)::int count FROM pg_stat_activity WHERE datname=current_database() AND wait_event='PgSleep' AND query LIKE '%UPDATE booking_schema.booking_holds%'`)).rows[0].count;if(active>0)return;await new Promise(resolve=>setTimeout(resolve,1));}throw new Error('Timed out waiting for authority race probe');}

async function expectEvidence(db:DatabaseService,visitId:string,count:number){expect((await db.query(`SELECT count(*)::int count FROM audit_schema.audit_log WHERE action='clinical.visit.completed' AND aggregate_type='clinical_visit' AND aggregate_id=$1`,[visitId])).rows[0].count).toBe(count);expect((await db.query(`SELECT count(*)::int count FROM booking_schema.outbox_events WHERE event_type='clinical.visit.completed' AND aggregate_type='clinical_visit' AND aggregate_id=$1`,[visitId])).rows[0].count).toBe(count);}

async function seed(db:DatabaseService){await db.query(`
 INSERT INTO identity_schema.users(id) VALUES('${I.owner}'),('${I.vet}'),('${I.foreignVet}'),('${I.admin}');
 INSERT INTO clinic_schema.clinics(id,legal_name,public_name) VALUES('${I.clinic}','Clinic','Clinic'),('${I.foreignClinic}','Foreign','Foreign');
 INSERT INTO clinic_schema.clinic_locations(id,clinic_id,address) VALUES('${I.location}','${I.clinic}','A'),('${I.foreignLocation}','${I.foreignClinic}','B');
 INSERT INTO clinic_schema.employee_location_memberships(employee_id,clinic_location_id,role) VALUES('${I.vet}','${I.location}','CLINIC_VETERINARIAN'),('${I.admin}','${I.location}','CLINIC_ADMIN'),('${I.foreignVet}','${I.foreignLocation}','CLINIC_VETERINARIAN');
 INSERT INTO clinic_schema.clinic_services(id,clinic_location_id,code,display_name,duration_minutes) VALUES('${I.service}','${I.location}','S','Service',30),('${I.invalidService}','${I.location}','I','Invalid',30);
 INSERT INTO clinic_schema.appointment_slots(id,clinic_location_id,service_id,starts_at,ends_at) VALUES('${I.slot}','${I.location}','${I.service}',clock_timestamp()-interval '1 hour',clock_timestamp()),('${I.invalidSlot}','${I.location}','${I.invalidService}',clock_timestamp()+interval '1 hour',clock_timestamp()+interval '2 hour'),('${I.raceSlot}','${I.location}','${I.invalidService}',clock_timestamp()+interval '2 hour',clock_timestamp()+interval '3 hour');
 INSERT INTO pet_schema.pets(id,owner_id,name,species) VALUES('${I.pet}','${I.owner}','Pet','DOG');
 INSERT INTO booking_schema.booking_holds(id,slot_id,owner_id,pet_id,state,expires_at) VALUES('${I.hold}','${I.slot}','${I.owner}','${I.pet}','CONFIRMED',clock_timestamp()+interval '1 hour'),('${I.invalidHold}','${I.invalidSlot}','${I.owner}','${I.pet}','MANUAL_CONFIRM_PENDING',clock_timestamp()+interval '1 hour'),('${I.raceHold}','${I.raceSlot}','${I.owner}','${I.pet}','CONFIRMED',clock_timestamp()+interval '1 hour');
 INSERT INTO booking_schema.appointments(id,hold_id,owner_id,pet_id,clinic_location_id,slot_id,status) VALUES('${I.appointment}','${I.hold}','${I.owner}','${I.pet}','${I.location}','${I.slot}','CONFIRMED'),('${I.invalidAppointment}','${I.invalidHold}','${I.owner}','${I.pet}','${I.location}','${I.invalidSlot}','CONFIRMED'),('${I.raceAppointment}','${I.raceHold}','${I.owner}','${I.pet}','${I.location}','${I.raceSlot}','CONFIRMED');
`);}
