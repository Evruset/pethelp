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

jest.setTimeout(60_000);

describe('Wave 3 DoctorShift HTTP authority',()=>{
  let app:INestApplication;let database:DatabaseService;let jwt:JwtService;
  const id={admin:randomUUID(),reception:randomUUID(),vetUser:randomUUID(),revoked:randomUUID(),clinic:randomUUID(),otherClinic:randomUUID(),location:randomUUID(),otherLocation:randomUUID(),specialty:randomUUID(),doctor:randomUUID(),foreignDoctor:randomUUID(),staff:randomUUID()};
  beforeAll(async()=>{
    process.env.WORKERS_ENABLED='false';
    app=await NestFactory.create(NestRoot,{logger:false});app.useGlobalFilters(new BookingErrorFilter());await app.init();database=app.get(DatabaseService);jwt=app.get(JwtService);
    await database.query(`INSERT INTO identity_schema.users(id) SELECT unnest($1::uuid[])`,[[id.admin,id.reception,id.vetUser,id.revoked]]);
    await database.query(`INSERT INTO clinic_schema.clinics(id,legal_name,public_name,status,timezone) VALUES($1,'W3 auth','W3 auth','ACTIVE','Europe/Moscow'),($2,'Foreign','Foreign','ACTIVE','Europe/Moscow')`,[id.clinic,id.otherClinic]);
    await database.query(`INSERT INTO clinic_schema.clinic_locations(id,clinic_id,address,status,timezone) VALUES($1,$2,'W3','ACTIVE','Europe/Moscow'),($3,$4,'Foreign','ACTIVE','Europe/Moscow')`,[id.location,id.clinic,id.otherLocation,id.otherClinic]);
    await database.query(`INSERT INTO clinic_schema.employee_location_memberships(employee_id,clinic_location_id,role,active,revoked_at) VALUES($1,$5,'CLINIC_ADMIN',true,NULL),($2,$5,'CLINIC_RECEPTIONIST',true,NULL),($3,$5,'CLINIC_VETERINARIAN',true,NULL),($4,$5,'CLINIC_ADMIN',false,clock_timestamp())`,[id.admin,id.reception,id.vetUser,id.revoked,id.location]);
    await database.query(`INSERT INTO catalog_schema.specialties(id,name,code) VALUES($1,'W3 auth',$2)`,[id.specialty,`w3_${id.specialty.replaceAll('-','')}`]);
    await database.query(`INSERT INTO catalog_schema.doctors(id,clinic_location_id,full_name,specialty_id,active,public_booking_enabled) VALUES($1,$2,'Local doctor',$5,true,true),($3,$4,'Foreign doctor',$5,true,true)`,[id.doctor,id.location,id.foreignDoctor,id.otherLocation,id.specialty]);
    await database.query(`INSERT INTO clinic_schema.clinic_staff(id,clinic_location_id,code,display_name,role,active) VALUES($1,$2,$3,'Local veterinarian','VETERINARIAN',true)`,[id.staff,id.location,`w3_${id.staff.replaceAll('-','')}`]);
  });
  afterAll(async()=>{await database.query(`DELETE FROM booking_schema.outbox_events WHERE producer='doctor-shift-inventory' AND aggregate_id=$1`,[id.staff]);await database.query(`DELETE FROM booking_schema.idempotency_records WHERE scope LIKE $1`,[`%:${id.admin}`]);await database.query(`DELETE FROM clinic_schema.clinic_staff WHERE id=$1`,[id.staff]);await database.query(`DELETE FROM catalog_schema.doctors WHERE id=ANY($1::uuid[])`,[[id.doctor,id.foreignDoctor]]);await database.query(`DELETE FROM catalog_schema.specialties WHERE id=$1`,[id.specialty]);await database.query(`DELETE FROM clinic_schema.employee_location_memberships WHERE employee_id=ANY($1::uuid[])`,[[id.admin,id.reception,id.vetUser,id.revoked]]);await database.query(`DELETE FROM clinic_schema.clinic_locations WHERE id=ANY($1::uuid[])`,[[id.location,id.otherLocation]]);await database.query(`DELETE FROM clinic_schema.clinics WHERE id=ANY($1::uuid[])`,[[id.clinic,id.otherClinic]]);await database.query(`DELETE FROM identity_schema.users WHERE id=ANY($1::uuid[])`,[[id.admin,id.reception,id.vetUser,id.revoked]]);await app.close();});
  const actor=(sub:string,role:Role,clinicIds=[id.clinic],locationIds=[id.location])=>({sub,roles:[role],clinicIds,locationIds});
  const token=(payload:ReturnType<typeof actor>)=>jwt.signAsync(payload,{secret:config.jwtSecret,issuer:config.jwtIssuer,audience:config.jwtAudience,algorithm:'HS256'});
  const map=async(payload:ReturnType<typeof actor>|null,doctorId=id.doctor,locationId=id.location)=>{let command=request(app.getHttpServer()).post(`/v1/clinic/${id.clinic}/locations/${locationId}/schedule/doctor-mappings`).set('Idempotency-Key',randomUUID()).send({staffId:id.staff,doctorId});if(payload)command=command.set('Authorization',`Bearer ${await token(payload)}`);return command;};
  const list=async(payload:ReturnType<typeof actor>,clinicId=id.clinic,locationId=id.location,days=14)=>request(app.getHttpServer()).get(`/v1/clinic/${clinicId}/locations/${locationId}/schedule/doctor-shifts`).query({from:new Date().toISOString(),to:new Date(Date.now()+days*86_400_000).toISOString()}).set('Authorization',`Bearer ${await token(payload)}`);

  it('allows bounded receptionist and veterinarian reads but binds the exact clinic-location pair',async()=>{
    for(const payload of [actor(id.reception,Role.CLINIC_RECEPTIONIST),actor(id.vetUser,Role.CLINIC_VETERINARIAN)]){
      const response=await list(payload);expect(response.status).toBe(200);expect(response.body).toMatchObject({clinicId:id.clinic,locationId:id.location});
    }
    const mismatch=await list(actor(id.admin,Role.CLINIC_ADMIN,[id.otherClinic],[id.location]),id.otherClinic,id.location);expect(mismatch.status).toBe(403);expect(JSON.stringify(mismatch.body)).not.toContain(id.doctor);
    expect((await list(actor(id.revoked,Role.CLINIC_ADMIN))).status).toBe(403);
    expect((await list(actor(id.admin,Role.CLINIC_ADMIN),id.clinic,id.location,32)).status).toBe(400);
  });

  it('requires authentication and Clinic Admin role with zero mapping effects',async()=>{
    for(const response of [await map(null),await map(actor(id.reception,Role.CLINIC_RECEPTIONIST)),await map(actor(id.vetUser,Role.CLINIC_VETERINARIAN))])expect(response.status).toBeGreaterThanOrEqual(401);
    expect((await database.query<{catalog_doctor_id:string|null}>(`SELECT catalog_doctor_id FROM clinic_schema.clinic_staff WHERE id=$1`,[id.staff])).rows[0].catalog_doctor_id).toBeNull();
  });

  it('denies revoked, missing and cross-location authority without existence leakage',async()=>{
    const denied=[await map(actor(id.revoked,Role.CLINIC_ADMIN)),await map(actor(id.admin,Role.CLINIC_ADMIN,[],[id.location])),await map(actor(id.admin,Role.CLINIC_ADMIN,[id.clinic],[id.otherLocation]),id.doctor,id.otherLocation)];
    for(const response of denied){expect(response.status).toBe(403);expect(JSON.stringify(response.body)).not.toContain(id.doctor);}
    expect((await database.query<{catalog_doctor_id:string|null}>(`SELECT catalog_doctor_id FROM clinic_schema.clinic_staff WHERE id=$1`,[id.staff])).rows[0].catalog_doctor_id).toBeNull();
  });

  it('fails closed for a foreign doctor and maps the exact same-location doctor once',async()=>{
    const foreign=await map(actor(id.admin,Role.CLINIC_ADMIN),id.foreignDoctor);expect(foreign.status).toBe(404);
    const success=await map(actor(id.admin,Role.CLINIC_ADMIN));expect(success.status).toBe(201);expect(success.body).toMatchObject({staff_id:id.staff,doctor_id:id.doctor});
    expect((await database.query<{catalog_doctor_id:string}>(`SELECT catalog_doctor_id::text FROM clinic_schema.clinic_staff WHERE id=$1`,[id.staff])).rows[0].catalog_doctor_id).toBe(id.doctor);
  });
});
