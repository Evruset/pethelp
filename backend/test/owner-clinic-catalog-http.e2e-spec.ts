import 'reflect-metadata';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { Role } from '../src/auth/auth.types';
import { BookingErrorFilter } from '../src/common/booking-error.filter';
import { DomainException } from '../src/common/domain-error';
import { config } from '../src/config';
import { NestRoot } from '../src/nest-root-full';
import { DatabaseService } from '../src/database/database.service';
import { randomUUID } from 'node:crypto';
import { featureFlags } from '../src/config/feature-flags.config';

jest.setTimeout(90_000);
describe('Owner clinic catalog HTTP authority',()=>{
  let app:INestApplication;let jwt:JwtService;
  beforeAll(async()=>{process.env.WORKERS_ENABLED='false';app=await NestFactory.create(NestRoot,{logger:false});app.useGlobalFilters(new BookingErrorFilter());app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true,exceptionFactory:()=>new DomainException(400,'INVALID_REQUEST','Request validation failed')}));await app.init();jwt=app.get(JwtService);});
  afterAll(async()=>app.close());
  const token=(roles:Role[])=>jwt.signAsync({sub:'11000000-0000-4000-8000-000000000001',roles},{secret:config.jwtSecret,issuer:config.jwtIssuer,audience:config.jwtAudience,algorithm:'HS256'});
  it('exposes bounded booking-expiration health without identifiers or payloads',async()=>{
    const response=await request(app.getHttpServer()).get('/v1/health').expect(200);
    expect(Object.keys(response.body.bookingExpiration).sort()).toEqual(['failuresTotal','lastSuccessAt','oldestOverdueAgeSeconds','overdueCount','pendingCount','processedTotal','running'].sort());
    expect(JSON.stringify(response.body.bookingExpiration)).not.toMatch(/holdId|ownerId|petId|slotId|payload/i);
  });
  it('requires an authenticated Owner and returns only the bounded shape',async()=>{
    await request(app.getHttpServer()).get('/v1/owner/clinic-catalog').expect(401);
    await request(app.getHttpServer()).get('/v1/owner/clinic-catalog').set('Authorization',`Bearer ${await token([Role.CLINIC_ADMIN])}`).expect(403);
    const response=await request(app.getHttpServer()).get('/v1/owner/clinic-catalog').set('Authorization',`Bearer ${await token([Role.OWNER])}`).expect(200);
    expect(Object.keys(response.body).sort()).toEqual(['clinics','observedAt']);
    for(const item of response.body.clinics){expect(Object.keys(item).sort()).toEqual(['address','clinicId','decisionSummary','locationId','name','phone']);expect(Object.keys(item.decisionSummary).sort()).toEqual(['confirmation','informationalPrice','nextAvailability']);}
  });
  it('protects and validates the clinic service route with masked not-found',async()=>{
    const path='/v1/owner/clinic-catalog/11111111-1111-4111-8111-111111111111/locations/22222222-2222-4222-8222-222222222222';
    await request(app.getHttpServer()).get(path).expect(401);
    await request(app.getHttpServer()).get(path).set('Authorization',`Bearer ${await token([Role.CLINIC_ADMIN])}`).expect(403);
    const missing=await request(app.getHttpServer()).get(path).set('Authorization',`Bearer ${await token([Role.OWNER])}`).expect(404);
    expect(missing.body).toEqual(expect.objectContaining({code:'OWNER_CLINIC_LOCATION_NOT_FOUND'}));
    await request(app.getHttpServer()).get('/v1/owner/clinic-catalog/not-a-uuid/locations/not-a-uuid').set('Authorization',`Bearer ${await token([Role.OWNER])}`).expect(400);
  });
  it('returns the exact Owner public service shape',async()=>{
    const db=app.get(DatabaseService),clinic=randomUUID(),location=randomUUID(),service=randomUUID();
    try{
      await db.query("INSERT INTO clinic_schema.clinics(id,legal_name,public_name,status) VALUES($1,'Legal','Public','ACTIVE')",[clinic]);
      await db.query("INSERT INTO clinic_schema.clinic_locations(id,clinic_id,address,status,timezone) VALUES($1,$2,'Address','ACTIVE','Europe/Moscow')",[location,clinic]);
      await db.query("INSERT INTO clinic_schema.clinic_services(id,clinic_location_id,code,display_name,duration_minutes,active,price_amount,currency) VALUES($1,$2,$3,'Осмотр',30,true,1250.00,'RUB')",[service,location,`S_${service.replaceAll('-','')}`]);
      const response=await request(app.getHttpServer()).get(`/v1/owner/clinic-catalog/${clinic}/locations/${location}`).set('Authorization',`Bearer ${await token([Role.OWNER])}`).expect(200);
      expect(Object.keys(response.body).sort()).toEqual(['address','clinicId','locationId','name','observedAt','phone','services']);
      expect(Object.keys(response.body.services[0]).sort()).toEqual(['name','price','serviceId','specialists','specialty']);
      expect(response.body.services[0].price).toEqual({kind:'INFORMATIONAL',amount:'1250.00',currency:'RUB'});
      expect(response.body.services[0]).toMatchObject({specialty:null,specialists:[]});
    } finally {
      await db.query('DELETE FROM clinic_schema.clinic_services WHERE id=$1',[service]);await db.query('DELETE FROM clinic_schema.clinic_locations WHERE id=$1',[location]);await db.query('DELETE FROM clinic_schema.clinics WHERE id=$1',[clinic]);
    }
  });
  const specialistHttpIt=featureFlags.OWNER_V50_DOCTOR_DISCOVERY?it:it.skip;
  specialistHttpIt('returns only the closed owner-safe specialist shape when explicitly enabled',async()=>{
    const db=app.get(DatabaseService),clinic=randomUUID(),location=randomUUID(),service=randomUUID(),doctor=randomUUID(),staff=randomUUID(),eligibility=randomUUID(),shift=randomUUID(),run=randomUUID(),slot=randomUUID(),actor=randomUUID();
    try{
      const specialty=(await db.query<{id:string}>('SELECT id FROM catalog_schema.specialties ORDER BY code LIMIT 1')).rows[0];
      await db.query("INSERT INTO clinic_schema.clinics(id,legal_name,public_name,status) VALUES($1,'R2E Legal','R2E Clinic','ACTIVE')",[clinic]);
      await db.query("INSERT INTO clinic_schema.clinic_locations(id,clinic_id,address,status,timezone) VALUES($1,$2,'R2E Address','ACTIVE','Europe/Moscow')",[location,clinic]);
      await db.query("INSERT INTO clinic_schema.clinic_services(id,clinic_location_id,code,display_name,duration_minutes,active,price_amount,currency) VALUES($1,$2,$3,'Осмотр',30,true,1250,'RUB')",[service,location,`S_${service.replaceAll('-','')}`]);
      await db.query('INSERT INTO identity_schema.users(id) VALUES($1)',[actor]);
      await db.query("INSERT INTO clinic_schema.employee_location_memberships(employee_id,clinic_location_id,role) VALUES($1,$2,'CLINIC_ADMIN')",[actor,location]);
      await db.query("INSERT INTO catalog_schema.doctors(id,clinic_location_id,full_name,specialty_id,active,public_booking_enabled) VALUES($1,$2,'Анна Иванова',$3,true,true)",[doctor,location,specialty.id]);
      await db.query("INSERT INTO catalog_schema.doctor_public_profile_consent_events(doctor_id,clinic_location_id,event_type,actor_id) VALUES($1,$2,'CONSENT_GRANTED',$3)",[doctor,location,actor]);
      await db.query("INSERT INTO clinic_schema.clinic_staff(id,clinic_location_id,code,display_name,role,active,catalog_doctor_id) VALUES($1,$2,$3,'Анна Иванова','VETERINARIAN',true,$4)",[staff,location,`ST_${staff}`,doctor]);
      await db.query('INSERT INTO clinic_schema.doctor_services(id,clinic_location_id,staff_id,doctor_id,service_id,active,created_by) VALUES($1,$2,$3,$4,$5,true,$6)',[eligibility,location,staff,doctor,service,actor]);
      await db.query("INSERT INTO clinic_schema.doctor_shifts(id,clinic_id,clinic_location_id,staff_id,doctor_id,starts_at,ends_at,timezone,status,created_by,updated_by,generation_version) VALUES($1,$2,$3,$4,$5,clock_timestamp()-interval '1 hour',clock_timestamp()+interval '8 hours','Europe/Moscow','PUBLISHED',$6,$6,1)",[shift,clinic,location,staff,doctor,actor]);
      await db.query("INSERT INTO clinic_schema.inventory_generation_runs(id,doctor_shift_id,shift_version,generation_version,rules_fingerprint,input_snapshot,status,completed_at,created_by) VALUES($1,$2,1,1,$3,'{}'::jsonb,'PUBLISHED',clock_timestamp(),$4)",[run,shift,'b'.repeat(64),actor]);
      await db.query("INSERT INTO clinic_schema.appointment_slots(id,clinic_location_id,service_id,staff_id,doctor_id,doctor_shift_id,doctor_service_id,generation_run_id,generation_version,duration_minutes_snapshot,starts_at,ends_at,capacity,state,source,publication_state,published_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,1,30,clock_timestamp()+interval '2 hours',clock_timestamp()+interval '150 minutes',1,'OPEN','DOCTOR_SHIFT','PUBLISHED',clock_timestamp())",[slot,location,service,staff,doctor,shift,eligibility,run]);
      const response=await request(app.getHttpServer()).get(`/v1/owner/clinic-catalog/${clinic}/locations/${location}`).set('Authorization',`Bearer ${await token([Role.OWNER])}`).expect(200);
      expect(response.body.services[0].specialists).toEqual([{doctorId:doctor,displayName:'Анна Иванова',specialtyName:expect.any(String),nextAvailability:{startsAt:expect.any(String),localDate:expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),localTime:expect.stringMatching(/^\d{2}:\d{2}$/),timezone:'Europe/Moscow'}}]);
      expect(Object.keys(response.body.services[0].specialists[0]).sort()).toEqual(['displayName','doctorId','nextAvailability','specialtyName']);
      expect(JSON.stringify(response.body.services[0].specialists[0])).not.toMatch(/phone|email|staff|role|auth|active|created|updated/i);
      const availabilityPath=`/v1/owner/clinic-catalog/${clinic}/locations/${location}/services/${service}/availability`;
      const selected=await request(app.getHttpServer()).get(`${availabilityPath}?doctorId=${doctor}`).set('Authorization',`Bearer ${await token([Role.OWNER])}`).expect(200);
      expect(selected.body.slots.map((item:{slotId:string})=>item.slotId)).toEqual([slot]);
      const unknown=await request(app.getHttpServer()).get(`${availabilityPath}?doctorId=${randomUUID()}`).set('Authorization',`Bearer ${await token([Role.OWNER])}`).expect(200);
      expect(unknown.body.slots).toEqual([]);
      await request(app.getHttpServer()).get(`${availabilityPath}?doctorId=not-a-uuid`).set('Authorization',`Bearer ${await token([Role.OWNER])}`).expect(400);
    }finally{
      await db.query('DELETE FROM clinic_schema.appointment_slots WHERE id=$1',[slot]);await db.query('DELETE FROM clinic_schema.inventory_generation_runs WHERE id=$1',[run]);await db.query('DELETE FROM clinic_schema.doctor_shifts WHERE id=$1',[shift]);await db.query('DELETE FROM clinic_schema.doctor_services WHERE id=$1',[eligibility]);await db.query('ALTER TABLE catalog_schema.doctor_public_profile_consent_events DISABLE TRIGGER doctor_public_profile_consent_audit_immutability_trigger');await db.query('DELETE FROM catalog_schema.doctor_public_profile_consent_events WHERE doctor_id=$1',[doctor]);await db.query('ALTER TABLE catalog_schema.doctor_public_profile_consent_events ENABLE TRIGGER doctor_public_profile_consent_audit_immutability_trigger');await db.query('DELETE FROM clinic_schema.clinic_staff WHERE id=$1',[staff]);await db.query('DELETE FROM clinic_schema.employee_location_memberships WHERE employee_id=$1 AND clinic_location_id=$2',[actor,location]);await db.query('DELETE FROM catalog_schema.doctors WHERE id=$1',[doctor]);await db.query('DELETE FROM clinic_schema.clinic_services WHERE id=$1',[service]);await db.query('DELETE FROM clinic_schema.clinic_locations WHERE id=$1',[location]);await db.query('DELETE FROM clinic_schema.clinics WHERE id=$1',[clinic]);await db.query('DELETE FROM identity_schema.users WHERE id=$1',[actor]);
    }
  });
  it('protects Owner availability and returns the exact empty shape',async()=>{
    const db=app.get(DatabaseService),clinic=randomUUID(),location=randomUUID(),service=randomUUID();
    const path=`/v1/owner/clinic-catalog/${clinic}/locations/${location}/services/${service}/availability`;
    try{
      await db.query("INSERT INTO clinic_schema.clinics(id,legal_name,public_name,status) VALUES($1,'Legal availability','Availability','ACTIVE')",[clinic]);
      await db.query("INSERT INTO clinic_schema.clinic_locations(id,clinic_id,address,status,timezone) VALUES($1,$2,'Address','ACTIVE','Europe/Moscow')",[location,clinic]);
      await db.query("INSERT INTO clinic_schema.clinic_services(id,clinic_location_id,code,display_name,duration_minutes,active,price_amount,currency) VALUES($1,$2,$3,'Осмотр',30,true,1250.00,'RUB')",[service,location,`S_${service.replaceAll('-','')}`]);
      await request(app.getHttpServer()).get(path).expect(401);await request(app.getHttpServer()).get(path).set('Authorization',`Bearer ${await token([Role.CLINIC_ADMIN])}`).expect(403);
      const response=await request(app.getHttpServer()).get(path).set('Authorization',`Bearer ${await token([Role.OWNER])}`).expect(200);expect(Object.keys(response.body).sort()).toEqual(['clinicName','horizonEndsAt','informationalPrice','observedAt','serviceName','slots','timezone']);expect(response.body.informationalPrice).toEqual({kind:'INFORMATIONAL',amount:'1250.00',currency:'RUB'});expect(response.body.slots).toEqual([]);
      await request(app.getHttpServer()).get(`${path}?doctorId=${randomUUID()}`).set('Authorization',`Bearer ${await token([Role.OWNER])}`).expect(404);
      await request(app.getHttpServer()).get(`${path}?doctorId=not-a-uuid`).set('Authorization',`Bearer ${await token([Role.OWNER])}`).expect(400);
      await request(app.getHttpServer()).get(`/v1/owner/clinic-catalog/${clinic}/locations/${location}/services/${randomUUID()}/availability`).set('Authorization',`Bearer ${await token([Role.OWNER])}`).expect(404);
      await request(app.getHttpServer()).get('/v1/owner/clinic-catalog/x/locations/y/services/z/availability').set('Authorization',`Bearer ${await token([Role.OWNER])}`).expect(400);
    }finally{await db.query('DELETE FROM clinic_schema.clinic_services WHERE id=$1',[service]);await db.query('DELETE FROM clinic_schema.clinic_locations WHERE id=$1',[location]);await db.query('DELETE FROM clinic_schema.clinics WHERE id=$1',[clinic]);}
  });
  it('protects and executes the closed PILOT booking request contract',async()=>{
    const db=app.get(DatabaseService),owner='11000000-0000-4000-8000-000000000001',pet=randomUUID(),clinic=randomUUID(),location=randomUUID(),service=randomUUID(),slot=randomUUID(),key=randomUUID();
    const path='/v1/booking-holds',body={petId:pet,clinicId:clinic,locationId:location,serviceId:service,slotId:slot,expectedSlotVersion:1};
    try{
      await db.query('INSERT INTO identity_schema.users(id) VALUES($1::uuid) ON CONFLICT DO NOTHING',[owner]);
      await db.query("INSERT INTO pet_schema.pets(id,owner_id,name,species) VALUES($1,$2,'HTTP pet','DOG')",[pet,owner]);
      await db.query("INSERT INTO clinic_schema.clinics(id,legal_name,public_name,status) VALUES($1,'HTTP Legal','HTTP Clinic','ACTIVE')",[clinic]);
      await db.query("INSERT INTO clinic_schema.clinic_locations(id,clinic_id,address,status,timezone) VALUES($1,$2,'HTTP address','ACTIVE','Europe/Moscow')",[location,clinic]);
      await db.query("INSERT INTO clinic_schema.clinic_services(id,clinic_location_id,code,display_name,duration_minutes,active) VALUES($1,$2,$3,'HTTP service',30,true)",[service,location,`S_${service.replaceAll('-','')}`]);
      await db.query("INSERT INTO clinic_schema.appointment_slots(id,clinic_location_id,service_id,starts_at,ends_at,capacity,integration_mode) VALUES($1,$2,$3,clock_timestamp()+interval '2 hours',clock_timestamp()+interval '150 minutes',1,'LEVEL_A')",[slot,location,service]);
      await request(app.getHttpServer()).post(path).set('Idempotency-Key',key).send(body).expect(401);
      await request(app.getHttpServer()).post(path).set('Authorization',`Bearer ${await token([Role.CLINIC_ADMIN])}`).set('Idempotency-Key',key).send(body).expect(403);
      const extra=await request(app.getHttpServer()).post(path).set('Authorization',`Bearer ${await token([Role.OWNER])}`).set('Idempotency-Key',randomUUID()).send({...body,price:'1500.00'}).expect(400);
      expect(extra.body).toMatchObject({code:'INVALID_REQUEST'});
      const hiddenLegacy=await request(app.getHttpServer()).post(path).set('Authorization',`Bearer ${await token([Role.OWNER])}`).set('Idempotency-Key',randomUUID()).send({...body,doctorId:null}).expect(400);
      expect(hiddenLegacy.body).toMatchObject({code:'INVALID_REQUEST'});
      const first=await request(app.getHttpServer()).post(path).set('Authorization',`Bearer ${await token([Role.OWNER])}`).set('Idempotency-Key',key).send(body).expect(201);
      expect(Object.keys(first.body).sort()).toEqual(['aggregateVersion','confirmationMode','correlationId','expiresAt','holdId','lastUpdatedAt','nextAction','serverNow','slotId','status']);
      expect(first.body).toMatchObject({status:'PENDING_CONFIRMATION',confirmationMode:'MANUAL',slotId:slot,nextAction:'READ_STATUS'});
      const replay=await request(app.getHttpServer()).post(path).set('Authorization',`Bearer ${await token([Role.OWNER])}`).set('Idempotency-Key',key).send(body).expect(201);
      expect(replay.body).toEqual(first.body);
      const identityConflict=await request(app.getHttpServer()).post(path).set('Authorization',`Bearer ${await token([Role.OWNER])}`).set('Idempotency-Key',key).send({...body,serviceId:randomUUID()}).expect(409);
      expect(identityConflict.body).toMatchObject({code:'IDEMPOTENCY_CONFLICT'});
      expect(JSON.stringify(identityConflict.body)).not.toMatch(/IDEMPOTENCY_PAYLOAD_CONFLICT|SLOT_VERSION_STALE/);
      const stale=await request(app.getHttpServer()).post(path).set('Authorization',`Bearer ${await token([Role.OWNER])}`).set('Idempotency-Key',randomUUID()).send(body).expect(409);
      expect(stale.body).toMatchObject({code:'BOOKING_STATE_CONFLICT'});
      expect(JSON.stringify(stale.body)).not.toMatch(/IDEMPOTENCY_PAYLOAD_CONFLICT|SLOT_VERSION_STALE/);
      const exactlyOnce=await db.query<{holds:string;held_count:number;effects:string;audits:string}>(`SELECT
        (SELECT COUNT(*)::text FROM booking_schema.booking_holds WHERE slot_id=$1) holds,
        (SELECT held_count FROM clinic_schema.appointment_slots WHERE id=$1) held_count,
        (SELECT COUNT(*)::text FROM booking_schema.outbox_events WHERE aggregate_id=$2 AND event_type='booking.hold.created.v1') effects,
        (SELECT COUNT(*)::text FROM audit_schema.audit_log WHERE aggregate_id=$2 AND action='booking.hold.created') audits`,[slot,first.body.holdId]);
      expect(exactlyOnce.rows[0]).toEqual({holds:'1',held_count:1,effects:'1',audits:'1'});
    }finally{
      await db.query('DELETE FROM booking_schema.outbox_events WHERE aggregate_id IN (SELECT id FROM booking_schema.booking_holds WHERE slot_id=$1)',[slot]);
      await db.query('DELETE FROM booking_schema.appointments WHERE slot_id=$1',[slot]);
      await db.query('DELETE FROM booking_schema.booking_holds WHERE slot_id=$1',[slot]);
      await db.query("DELETE FROM booking_schema.idempotency_records WHERE scope=$1",[`booking.create-local-hold:${owner}`]);
      await db.query('DELETE FROM clinic_schema.appointment_slots WHERE id=$1',[slot]);await db.query('DELETE FROM clinic_schema.clinic_services WHERE id=$1',[service]);await db.query('DELETE FROM clinic_schema.clinic_locations WHERE id=$1',[location]);await db.query('DELETE FROM clinic_schema.clinics WHERE id=$1',[clinic]);await db.query('DELETE FROM pet_schema.pets WHERE id=$1',[pet]);
    }
  });
});
