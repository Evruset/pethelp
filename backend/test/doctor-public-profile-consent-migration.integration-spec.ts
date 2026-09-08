import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { Client } from 'pg';
import { DatabaseService } from '../src/database/database.service';
import { PublicCatalogService } from '../src/public-catalog/public-catalog.service';

jest.setTimeout(240_000);

const PREDECESSOR = '1719620000000_enforce_one_clinical_result_per_visit';

describe('doctor public-profile consent migration (isolated PostgreSQL)', () => {
  it('migrates a clean database and keeps public identity default-deny', async () => {
    await withDatabase('clean', async (target) => {
      run('up', target);
      const client = await connected(target);
      try {
        expect((await client.query(`SELECT to_regclass('clinic_schema.doctor_services') value`)).rows[0].value).toBe('clinic_schema.doctor_services');
        expect((await client.query(`SELECT to_regclass('catalog_schema.doctor_public_profile_consent_events') value`)).rows[0].value).toBe('catalog_schema.doctor_public_profile_consent_events');
        expect((await client.query(`SELECT count(*)::int count FROM catalog_schema.doctor_public_profile_consent_events`)).rows[0].count).toBe(0);
        await proveProjectionConsentLifecycle(client, target);
      } finally {
        await client.end();
      }
    });
  });

  it('forwards an existing workforce database without a backfill or manual SQL prerequisite', async () => {
    await withDatabase('forward', async (target) => {
      run('up', target, PREDECESSOR);
      const client = await connected(target);
      const ids = {
        actor: '11111111-1111-4111-8111-111111111111',
        unauthorized: '11111111-1111-4111-8111-111111111112',
        clinic: '22222222-2222-4222-8222-222222222222',
        location: '33333333-3333-4333-8333-333333333333',
        specialty: '44444444-4444-4444-8444-444444444444',
        doctor: '55555555-5555-4555-8555-555555555555',
      };
      try {
        await client.query(`INSERT INTO identity_schema.users(id) VALUES($1),($2)`, [ids.actor,ids.unauthorized]);
        await client.query(`INSERT INTO clinic_schema.clinics(id,legal_name,public_name,status,timezone) VALUES($1,'Legacy','Legacy','ACTIVE','Europe/Moscow')`, [ids.clinic]);
        await client.query(`INSERT INTO clinic_schema.clinic_locations(id,clinic_id,address,status,timezone) VALUES($1,$2,'Legacy','ACTIVE','Europe/Moscow')`, [ids.location, ids.clinic]);
        await client.query(`INSERT INTO clinic_schema.employee_location_memberships(employee_id,clinic_location_id,role,active) VALUES($1,$2,'CLINIC_ADMIN',true)`, [ids.actor, ids.location]);
        await client.query(`INSERT INTO clinic_schema.employee_location_memberships(employee_id,clinic_location_id,role,active) VALUES($1,$2,'CLINIC_RECEPTIONIST',true)`, [ids.unauthorized, ids.location]);
        await client.query(`INSERT INTO catalog_schema.specialties(id,name,code) VALUES($1,'Legacy','LEGACY')`, [ids.specialty]);
        await client.query(`INSERT INTO catalog_schema.doctors(id,clinic_location_id,full_name,specialty_id,active,public_booking_enabled) VALUES($1,$2,'Legacy Doctor',$3,true,true)`, [ids.doctor, ids.location, ids.specialty]);

        run('up', target);
        expect((await client.query(`SELECT count(*)::int count FROM catalog_schema.doctors WHERE id=$1`, [ids.doctor])).rows[0].count).toBe(1);
        expect((await client.query(`SELECT count(*)::int count FROM catalog_schema.doctor_public_profile_consent_events WHERE doctor_id=$1`, [ids.doctor])).rows[0].count).toBe(0);
        await expect(client.query(`INSERT INTO catalog_schema.doctor_public_profile_consent_events(doctor_id,clinic_location_id,event_type,actor_id) VALUES($1,$2,'CONSENT_GRANTED',$3)`,[ids.doctor,ids.location,ids.unauthorized])).rejects.toThrow(/ACTOR_NOT_AUTHORIZED/);

        const granted = (await client.query<{id:string}>(`INSERT INTO catalog_schema.doctor_public_profile_consent_events(doctor_id,clinic_location_id,event_type,actor_id) VALUES($1,$2,'CONSENT_GRANTED',$3) RETURNING id`, [ids.doctor, ids.location, ids.actor])).rows[0].id;
        await client.query(`INSERT INTO catalog_schema.doctor_public_profile_consent_events(doctor_id,clinic_location_id,event_type,actor_id) VALUES($1,$2,'CONSENT_REVOKED',$3)`, [ids.doctor, ids.location, ids.actor]);
        expect((await client.query(`SELECT event_type,actor_id::text FROM catalog_schema.doctor_public_profile_consent_events WHERE doctor_id=$1 ORDER BY occurred_at,id`, [ids.doctor])).rows).toEqual([
          { event_type: 'CONSENT_GRANTED', actor_id: ids.actor },
          { event_type: 'CONSENT_REVOKED', actor_id: ids.actor },
        ]);
        await expect(client.query(`UPDATE catalog_schema.doctor_public_profile_consent_events SET actor_id=$2 WHERE id=$1`, [granted, ids.actor])).rejects.toThrow(/AUDIT_IMMUTABLE/);
        await expect(client.query(`TRUNCATE catalog_schema.doctor_public_profile_consent_events`)).rejects.toThrow(/AUDIT_IMMUTABLE/);
      } finally {
        await client.end();
      }
    });
  });
});

async function proveProjectionConsentLifecycle(client: Client, databaseUrl: string) {
  const ids = {
    actor:'71000000-0000-4000-8000-000000000001', clinic:'71000000-0000-4000-8000-000000000002',
    location:'71000000-0000-4000-8000-000000000003', specialty:'71000000-0000-4000-8000-000000000004',
    doctor:'71000000-0000-4000-8000-000000000005', staff:'71000000-0000-4000-8000-000000000006',
    service:'71000000-0000-4000-8000-000000000007', eligibility:'71000000-0000-4000-8000-000000000008',
    shift:'71000000-0000-4000-8000-000000000009', run:'71000000-0000-4000-8000-000000000010',
    slot:'71000000-0000-4000-8000-000000000011',
    raceDoctor:'71000000-0000-4000-8000-000000000012',
    blockedRaceDoctor:'71000000-0000-4000-8000-000000000013',
  };
  await client.query(`INSERT INTO identity_schema.users(id) VALUES($1)`,[ids.actor]);
  await client.query(`INSERT INTO clinic_schema.clinics(id,legal_name,public_name,status,timezone) VALUES($1,'Safe legal','Safe clinic','ACTIVE','Europe/Moscow')`,[ids.clinic]);
  await client.query(`INSERT INTO clinic_schema.clinic_locations(id,clinic_id,address,status,timezone) VALUES($1,$2,'Safe address','ACTIVE','Europe/Moscow')`,[ids.location,ids.clinic]);
  await client.query(`INSERT INTO clinic_schema.employee_location_memberships(employee_id,clinic_location_id,role,active) VALUES($1,$2,'CLINIC_ADMIN',true)`,[ids.actor,ids.location]);
  await client.query(`INSERT INTO catalog_schema.specialties(id,name,code) VALUES($1,'Хирург','SAFE_SPECIALTY')`,[ids.specialty]);
  await client.query(`INSERT INTO catalog_schema.doctors(id,clinic_location_id,full_name,specialty_id,active,public_booking_enabled) VALUES($1,$2,'Анна Петрова',$3,true,true)`,[ids.doctor,ids.location,ids.specialty]);
  await client.query(`INSERT INTO catalog_schema.doctors(id,clinic_location_id,full_name,specialty_id,active,public_booking_enabled) VALUES($1,$2,'Race Doctor',$3,true,true)`,[ids.raceDoctor,ids.location,ids.specialty]);
  await client.query(`INSERT INTO catalog_schema.doctors(id,clinic_location_id,full_name,specialty_id,active,public_booking_enabled) VALUES($1,$2,'Blocked Race Doctor',$3,true,true)`,[ids.blockedRaceDoctor,ids.location,ids.specialty]);
  await client.query(`INSERT INTO clinic_schema.clinic_staff(id,clinic_location_id,code,display_name,role,active,catalog_doctor_id) VALUES($1,$2,'SAFE_STAFF','Анна Петрова','VETERINARIAN',true,$3)`,[ids.staff,ids.location,ids.doctor]);
  await client.query(`INSERT INTO clinic_schema.clinic_services(id,clinic_location_id,code,display_name,duration_minutes,active,price_amount,currency) VALUES($1,$2,'SAFE_SERVICE','Приём',30,true,1000,'RUB')`,[ids.service,ids.location]);
  await client.query(`INSERT INTO catalog_schema.specialty_services(service_id,specialty_id,created_by) VALUES($1,$2,$3)`,[ids.service,ids.specialty,ids.actor]);
  await client.query(`INSERT INTO catalog_schema.specialty_services(service_id,specialty_id,created_by) VALUES($1,$2,$3)`,[ids.service,ids.specialty,ids.actor]);
  await client.query(`INSERT INTO clinic_schema.doctor_services(id,clinic_location_id,staff_id,doctor_id,service_id,created_by) VALUES($1,$2,$3,$4,$5,$6)`,[ids.eligibility,ids.location,ids.staff,ids.doctor,ids.service,ids.actor]);
  await client.query(`INSERT INTO clinic_schema.doctor_shifts(id,clinic_id,clinic_location_id,staff_id,doctor_id,starts_at,ends_at,timezone,status,aggregate_version,generation_version,created_by,updated_by) VALUES($1,$2,$3,$4,$5,clock_timestamp()+interval '1 day',clock_timestamp()+interval '1 day 30 minutes','Europe/Moscow','PUBLISHED',1,1,$6,$6)`,[ids.shift,ids.clinic,ids.location,ids.staff,ids.doctor,ids.actor]);
  await client.query(`INSERT INTO clinic_schema.inventory_generation_runs(id,doctor_shift_id,shift_version,generation_version,rules_fingerprint,input_snapshot,status,slot_count,created_by,completed_at) VALUES($1,$2,1,1,repeat('a',64),'{}','PUBLISHED',1,$3,clock_timestamp())`,[ids.run,ids.shift,ids.actor]);
  await client.query(`INSERT INTO clinic_schema.appointment_slots(id,clinic_location_id,service_id,staff_id,doctor_id,starts_at,ends_at,capacity,held_count,booked_count,state,source,doctor_shift_id,doctor_service_id,generation_run_id,generation_version,duration_minutes_snapshot,publication_state,published_at) VALUES($1,$2,$3,$4,$5,clock_timestamp()+interval '1 day',clock_timestamp()+interval '1 day 30 minutes',1,0,0,'OPEN','DOCTOR_SHIFT',$6,$7,$8,1,30,'PUBLISHED',clock_timestamp())`,[ids.slot,ids.location,ids.service,ids.staff,ids.doctor,ids.shift,ids.eligibility,ids.run]);

  const catalog = new PublicCatalogService({query:(sql:string,values?:readonly unknown[])=>client.query(sql,values as unknown[])} as unknown as DatabaseService);
  const read=()=>catalog.readOwnerSpecialistDiscovery({specialtyId:ids.specialty,limit:25});
  expect((await read()).doctors).toEqual([]);
  await client.query(`INSERT INTO catalog_schema.doctor_public_profile_consent_events(doctor_id,clinic_location_id,event_type,actor_id) VALUES($1,$2,'CONSENT_GRANTED',$3)`,[ids.doctor,ids.location,ids.actor]);
  const enabled=await read();
  expect(enabled.doctors).toHaveLength(1);
  expect(Object.keys(enabled.doctors[0]).sort()).toEqual(['address','clinicId','clinicName','doctorId','doctorName','latitude','locationId','longitude','serviceCode','serviceId','serviceName','slots','specialtyId','specialtyName','timezone']);
  await client.query(`UPDATE clinic_schema.clinic_staff SET active=false WHERE id=$1`,[ids.staff]); expect((await read()).doctors).toEqual([]);
  await client.query(`UPDATE clinic_schema.clinic_staff SET active=true WHERE id=$1`,[ids.staff]);
  await client.query(`UPDATE clinic_schema.doctor_services SET active=false WHERE id=$1`,[ids.eligibility]); expect((await read()).doctors).toEqual([]);
  await client.query(`UPDATE clinic_schema.doctor_services SET active=true WHERE id=$1`,[ids.eligibility]);
  await client.query(`UPDATE clinic_schema.appointment_slots SET state='CLOSED',publication_state='BLOCKED',published_at=NULL,blocked_at=clock_timestamp() WHERE id=$1`,[ids.slot]); expect((await read()).doctors).toEqual([]);
  await client.query(`UPDATE clinic_schema.appointment_slots SET state='OPEN',publication_state='PUBLISHED',published_at=clock_timestamp(),blocked_at=NULL WHERE id=$1`,[ids.slot]);
  await client.query(`INSERT INTO catalog_schema.doctor_public_profile_consent_events(doctor_id,clinic_location_id,event_type,actor_id) VALUES($1,$2,'CONSENT_REVOKED',$3)`,[ids.doctor,ids.location,ids.actor]);
  expect((await read()).doctors).toEqual([]);

  const eventConnection=await connected(databaseUrl); const membershipConnection=await connected(databaseUrl);
  try {
    await eventConnection.query('BEGIN');
    await eventConnection.query(`INSERT INTO catalog_schema.doctor_public_profile_consent_events(doctor_id,clinic_location_id,event_type,actor_id) VALUES($1,$2,'CONSENT_GRANTED',$3)`,[ids.raceDoctor,ids.location,ids.actor]);
    await membershipConnection.query(`SET lock_timeout='100ms'`);
    await expect(membershipConnection.query(`UPDATE clinic_schema.employee_location_memberships SET active=false,revoked_at=clock_timestamp() WHERE employee_id=$1 AND clinic_location_id=$2`,[ids.actor,ids.location])).rejects.toMatchObject({code:'55P03'});
    await eventConnection.query('COMMIT');
    await membershipConnection.query(`SET lock_timeout=0`);
    await membershipConnection.query(`UPDATE clinic_schema.employee_location_memberships SET active=false,revoked_at=clock_timestamp() WHERE employee_id=$1 AND clinic_location_id=$2`,[ids.actor,ids.location]);
    await membershipConnection.query(`UPDATE clinic_schema.employee_location_memberships SET active=true,revoked_at=NULL WHERE employee_id=$1 AND clinic_location_id=$2`,[ids.actor,ids.location]);

    await membershipConnection.query('BEGIN');
    await membershipConnection.query(`UPDATE clinic_schema.employee_location_memberships SET active=false,revoked_at=clock_timestamp() WHERE employee_id=$1 AND clinic_location_id=$2`,[ids.actor,ids.location]);
    const eventPid=(await eventConnection.query<{pid:number}>('SELECT pg_backend_pid() pid')).rows[0].pid;
    const blockedInsert=eventConnection.query(`INSERT INTO catalog_schema.doctor_public_profile_consent_events(doctor_id,clinic_location_id,event_type,actor_id) VALUES($1,$2,'CONSENT_GRANTED',$3)`,[ids.blockedRaceDoctor,ids.location,ids.actor]);
    await waitForLock(client,eventPid);
    await membershipConnection.query('COMMIT');
    await expect(blockedInsert).rejects.toMatchObject({code:'23514'});
  } finally { await Promise.all([eventConnection.end(),membershipConnection.end()]); }
}

async function waitForLock(observer:Client,pid:number) {
  for(let attempt=0;attempt<20;attempt+=1){
    const row=(await observer.query<{wait_event_type:string|null}>('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[pid])).rows[0];
    if(row?.wait_event_type==='Lock') return;
    await new Promise(resolve=>setTimeout(resolve,25));
  }
  throw new Error('consent insert did not wait on the membership lock');
}

async function connected(databaseUrl: string) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  return client;
}

async function withDatabase(label: string, body: (databaseUrl: string) => Promise<void>) {
  const configured = process.env.DATABASE_URL;
  if (!configured) throw new Error('DATABASE_URL is required');
  const admin = await connected(configured);
  const name = `vethelp_public_consent_${label}_${process.pid}_${Date.now()}`;
  const target = new URL(configured);
  target.pathname = `/${name}`;
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    await body(target.toString());
  } finally {
    await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1`, [name]);
    await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
    await admin.end();
  }
}

function run(direction: 'up' | 'down', databaseUrl: string, to?: string) {
  const args = [direction, '--migrations-dir', 'migrations/node-pg', '--migrations-schema', 'public', '--migrations-table', 'schema_migrations', '--single-transaction'];
  if (to) args.push('--to', to);
  execFileSync(join(process.cwd(), 'node_modules/.bin/node-pg-migrate'), args, {
    cwd: process.cwd(), env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: 'pipe',
  });
}
