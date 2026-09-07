import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {Client} from 'pg';

jest.setTimeout(180_000);

describe('approved DoctorShift migration on isolated PostgreSQL',()=>{
  it('is repeatable, preserves manual slots, reverses empty, and refuses destructive down',async()=>{
    const configured=process.env.DATABASE_URL;if(!configured)throw new Error('DATABASE_URL is required');
    const admin=new Client({connectionString:configured});const name=`vethelp_w3_${process.pid}_${Date.now()}`;const target=new URL(configured);target.pathname=`/${name}`;let client:Client|null=null;
    await admin.connect();
    try{
      await admin.query(`CREATE DATABASE "${name}"`);run('up',target.toString());run('up',target.toString());
      client=new Client({connectionString:target.toString()});await client.connect();
      expect((await client.query(`SELECT count(*)::int count FROM public.schema_migrations WHERE name='1719540000000_add_doctor_shift_generated_inventory'`)).rows[0].count).toBe(1);
      run('down',target.toString());
      expect((await client.query(`SELECT to_regclass('clinic_schema.doctor_shifts') value`)).rows[0].value).toBe('clinic_schema.doctor_shifts');
      run('down',target.toString());
      expect((await client.query(`SELECT to_regclass('clinic_schema.doctor_shifts') value`)).rows[0].value).toBeNull();
      const ids={user:'11111111-1111-4111-8111-111111111111',clinic:'22222222-2222-4222-8222-222222222222',location:'33333333-3333-4333-8333-333333333333',service:'44444444-4444-4444-8444-444444444444',staff:'55555555-5555-4555-8555-555555555555',specialty:'66666666-6666-4666-8666-666666666666',doctor:'77777777-7777-4777-8777-777777777777',slot:'88888888-8888-4888-8888-888888888888'};
      await client.query(`INSERT INTO identity_schema.users(id) VALUES($1)`,[ids.user]);
      await client.query(`INSERT INTO clinic_schema.clinics(id,legal_name,public_name,status,timezone) VALUES($1,'W3','W3','ACTIVE','Europe/Moscow')`,[ids.clinic]);
      await client.query(`INSERT INTO clinic_schema.clinic_locations(id,clinic_id,address,status) VALUES($1,$2,'W3','ACTIVE')`,[ids.location,ids.clinic]);
      await client.query(`INSERT INTO clinic_schema.clinic_services(id,clinic_location_id,code,display_name,duration_minutes,active,price_amount,currency) VALUES($1,$2,'W3','W3',30,true,1,'RUB')`,[ids.service,ids.location]);
      await client.query(`INSERT INTO clinic_schema.clinic_staff(id,clinic_location_id,code,display_name,role,active) VALUES($1,$2,'W3','W3','VETERINARIAN',true)`,[ids.staff,ids.location]);
      await client.query(`INSERT INTO catalog_schema.specialties(id,name,code) VALUES($1,'W3','W3_MIGRATION')`,[ids.specialty]);
      await client.query(`INSERT INTO catalog_schema.doctors(id,clinic_location_id,full_name,specialty_id,active,public_booking_enabled) VALUES($1,$2,'W3',$3,true,true)`,[ids.doctor,ids.location,ids.specialty]);
      await client.query(`INSERT INTO clinic_schema.appointment_slots(id,clinic_location_id,service_id,staff_id,starts_at,ends_at,capacity,held_count,booked_count,state,source) VALUES($1,$2,$3,$4,clock_timestamp()+interval '1 day',clock_timestamp()+interval '1 day 30 minutes',3,1,1,'OPEN','MANUAL')`,[ids.slot,ids.location,ids.service,ids.staff]);
      run('up',target.toString());
      expect((await client.query(`SELECT id::text,capacity,held_count,booked_count,doctor_shift_id,generation_run_id,publication_state FROM clinic_schema.appointment_slots WHERE id=$1`,[ids.slot])).rows[0]).toEqual({id:ids.slot,capacity:3,held_count:1,booked_count:1,doctor_shift_id:null,generation_run_id:null,publication_state:'PUBLISHED'});
      await client.query(`UPDATE clinic_schema.clinic_staff SET catalog_doctor_id=$2 WHERE id=$1`,[ids.staff,ids.doctor]);
      await client.query(`INSERT INTO clinic_schema.doctor_services(clinic_location_id,staff_id,doctor_id,service_id,slot_capacity,created_by) VALUES($1,$2,$3,$4,1,$5)`,[ids.location,ids.staff,ids.doctor,ids.service,ids.user]);
      run('down',target.toString());
      expect(()=>run('down',target.toString())).toThrow();
      expect((await client.query(`SELECT to_regclass('clinic_schema.doctor_services') value`)).rows[0].value).toBe('clinic_schema.doctor_services');
    }finally{
      await client?.end();await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1`,[name]);await admin.query(`DROP DATABASE IF EXISTS "${name}"`);await admin.end();
    }
  });
});

function run(direction:'up'|'down',databaseUrl:string){
  execFileSync(join(process.cwd(),'node_modules/.bin/node-pg-migrate'),[direction,'--migrations-dir','migrations/node-pg','--migrations-schema','public','--migrations-table','schema_migrations','--single-transaction'],{cwd:process.cwd(),env:{...process.env,DATABASE_URL:databaseUrl},stdio:'pipe'});
}
