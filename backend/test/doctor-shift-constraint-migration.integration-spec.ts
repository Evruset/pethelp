import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {Client} from 'pg';

jest.setTimeout(180_000);

describe('DoctorShift publication timestamp corrective migration', () => {
  it('is fail-closed, reversible, strict, and preserves rows and schema shape', async () => {
    const configured = process.env.DATABASE_URL;
    if (!configured) throw new Error('DATABASE_URL is required');
    const admin = new Client({connectionString: configured});
    const name = `vethelp_w3_constraint_${process.pid}_${Date.now()}`;
    const target = new URL(configured); target.pathname = `/${name}`;
    let client: Client | null = null;
    await admin.connect();
    try {
      await admin.query(`CREATE DATABASE "${name}"`);
      run('up', target.toString());
      client = new Client({connectionString: target.toString()}); await client.connect();
      expect((await client.query(`SELECT count(*)::int count FROM public.schema_migrations WHERE name='1719550000000_tighten_doctor_shift_publication_timestamp_constraint'`)).rows[0].count).toBe(1);

      const ids = {user:'11111111-1111-4111-8111-111111111112',clinic:'22222222-2222-4222-8222-222222222223',location:'33333333-3333-4333-8333-333333333334',service:'44444444-4444-4444-8444-444444444445',staff:'55555555-5555-4555-8555-555555555556',slot:'88888888-8888-4888-8888-888888888889',importSlot:'88888888-8888-4888-8888-888888888890'};
      await client.query(`INSERT INTO identity_schema.users(id) VALUES($1)`, [ids.user]);
      await client.query(`INSERT INTO clinic_schema.clinics(id,legal_name,public_name,status,timezone) VALUES($1,'W3C','W3C','ACTIVE','Europe/Moscow')`, [ids.clinic]);
      await client.query(`INSERT INTO clinic_schema.clinic_locations(id,clinic_id,address,status,timezone) VALUES($1,$2,'W3C','ACTIVE','Europe/Moscow')`, [ids.location,ids.clinic]);
      await client.query(`INSERT INTO clinic_schema.clinic_services(id,clinic_location_id,code,display_name,duration_minutes,active,price_amount,currency) VALUES($1,$2,'W3C','W3C',30,true,1,'RUB')`, [ids.service,ids.location]);
      await client.query(`INSERT INTO clinic_schema.clinic_staff(id,clinic_location_id,code,display_name,role,active) VALUES($1,$2,'W3C','W3C','VETERINARIAN',true)`, [ids.staff,ids.location]);
      await client.query(`INSERT INTO clinic_schema.appointment_slots(id,clinic_location_id,service_id,staff_id,starts_at,ends_at,capacity,held_count,booked_count,state,source,publication_state) VALUES($1,$2,$3,$4,clock_timestamp()+interval '1 day',clock_timestamp()+interval '1 day 30 minutes',3,1,1,'OPEN','MANUAL','PUBLISHED')`, [ids.slot,ids.location,ids.service,ids.staff]);
      await client.query(`INSERT INTO clinic_schema.appointment_slots(id,clinic_location_id,service_id,staff_id,starts_at,ends_at,capacity,held_count,booked_count,state,source,publication_state) VALUES($1,$2,$3,$4,clock_timestamp()+interval '2 days',clock_timestamp()+interval '2 days 30 minutes',4,0,0,'OPEN','IMPORT','PUBLISHED')`, [ids.importSlot,ids.location,ids.service,ids.staff]);
      const before = (await client.query(`SELECT id::text,capacity,held_count,booked_count,state,source FROM clinic_schema.appointment_slots WHERE id=$1`, [ids.slot])).rows[0];
      const shape = await client.query(`SELECT column_name,data_type FROM information_schema.columns WHERE table_schema='clinic_schema' AND table_name='appointment_slots' ORDER BY ordinal_position`);
      const indexes = await client.query(`SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='clinic_schema' AND tablename='appointment_slots' ORDER BY indexname`);

      await expect(client.query(`UPDATE clinic_schema.appointment_slots SET publication_state='BLOCKED',blocked_at=clock_timestamp(),published_at=clock_timestamp() WHERE id=$1`, [ids.slot])).rejects.toMatchObject({code:'23514'});
      await expect(client.query(`UPDATE clinic_schema.appointment_slots SET publication_state='UNPUBLISHED',unpublished_at=clock_timestamp(),blocked_at=clock_timestamp() WHERE id=$1`, [ids.slot])).rejects.toMatchObject({code:'23514'});
      await expect(client.query(`UPDATE clinic_schema.appointment_slots SET publication_state='STALE_SOURCE',source_stale_at=clock_timestamp(),unpublished_at=clock_timestamp() WHERE id=$1`, [ids.slot])).rejects.toMatchObject({code:'23514'});
      await client.query(`UPDATE clinic_schema.appointment_slots SET state='CLOSED',publication_state='BLOCKED',published_at=NULL,unpublished_at=NULL,blocked_at=clock_timestamp(),source_stale_at=NULL WHERE id=$1`, [ids.slot]);
      await client.query(`UPDATE clinic_schema.appointment_slots SET publication_state='UNPUBLISHED',published_at=NULL,unpublished_at=clock_timestamp(),blocked_at=NULL,source_stale_at=NULL WHERE id=$1`, [ids.slot]);
      await client.query(`UPDATE clinic_schema.appointment_slots SET publication_state='DRAFT',published_at=NULL,unpublished_at=NULL,blocked_at=NULL,source_stale_at=NULL WHERE id=$1`, [ids.slot]);
      await client.query(`UPDATE clinic_schema.appointment_slots SET state='OPEN',publication_state='PUBLISHED',published_at=NULL,unpublished_at=NULL,blocked_at=NULL,source_stale_at=NULL WHERE id=$1`, [ids.slot]);

      run('down', target.toString());
      await client.query(`UPDATE clinic_schema.appointment_slots SET state='CLOSED',publication_state='BLOCKED',published_at=clock_timestamp(),unpublished_at=clock_timestamp(),blocked_at=clock_timestamp(),source_stale_at=NULL WHERE id=$1`, [ids.slot]);
      expectMigrationRemediationRefusal(target.toString(), ids.slot);
      await client.query(`UPDATE clinic_schema.appointment_slots SET published_at=NULL,unpublished_at=NULL WHERE id=$1`, [ids.slot]);
      run('up', target.toString());

      expect((await client.query(`SELECT id::text,capacity,held_count,booked_count,state,source FROM clinic_schema.appointment_slots WHERE id=$1`, [ids.slot])).rows[0]).toEqual({...before,state:'CLOSED'});
      expect((await client.query(`SELECT id::text,capacity,source,doctor_shift_id,generation_run_id,publication_state FROM clinic_schema.appointment_slots WHERE id=$1`, [ids.importSlot])).rows[0]).toEqual({id:ids.importSlot,capacity:4,source:'IMPORT',doctor_shift_id:null,generation_run_id:null,publication_state:'PUBLISHED'});
      expect((await client.query(`SELECT column_name,data_type FROM information_schema.columns WHERE table_schema='clinic_schema' AND table_name='appointment_slots' ORDER BY ordinal_position`)).rows).toEqual(shape.rows);
      expect((await client.query(`SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='clinic_schema' AND tablename='appointment_slots' ORDER BY indexname`)).rows).toEqual(indexes.rows);
    } finally {
      await client?.end(); await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1`, [name]); await admin.query(`DROP DATABASE IF EXISTS "${name}"`); await admin.end();
    }
  });
});

function run(direction: 'up'|'down', databaseUrl: string) {
  execFileSync(join(process.cwd(),'node_modules/.bin/node-pg-migrate'), [direction,'--migrations-dir','migrations/node-pg','--migrations-schema','public','--migrations-table','schema_migrations','--single-transaction'], {cwd:process.cwd(),env:{...process.env,DATABASE_URL:databaseUrl},stdio:'pipe'});
}

function expectMigrationRemediationRefusal(databaseUrl: string, rowId: string) {
  try { run('up', databaseUrl); throw new Error('migration unexpectedly succeeded'); }
  catch (error) {
    const stderr = String((error as {stderr?: Buffer}).stderr ?? error);
    expect(stderr).toContain('DOCTORSHIFT_CONSTRAINT_DATA_REMEDIATION_APPROVAL_REQUIRED');
    expect(stderr).toContain(rowId);
  }
}
