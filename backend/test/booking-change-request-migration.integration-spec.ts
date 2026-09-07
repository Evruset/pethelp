import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {Client} from 'pg';

jest.setTimeout(180_000);

describe('BookingChangeRequest migration', () => {
  it('upgrades populated schema, enforces bindings and active uniqueness, and is reversible', async () => {
    const configured=process.env.DATABASE_URL;
    if(!configured)throw new Error('DATABASE_URL is required');
    const admin=new Client({connectionString:configured});
    const name=`vethelp_w5a1_${process.pid}_${Date.now()}`;
    const target=new URL(configured); target.pathname=`/${name}`;
    let client:Client|null=null;
    await admin.connect();
    try{
      await admin.query(`CREATE DATABASE "${name}"`);
      run('up',target.toString());
      run('down',target.toString());
      client=new Client({connectionString:target.toString()}); await client.connect();
      const id={owner:'11000000-0000-4000-8000-000000000001',clinic:'21000000-0000-4000-8000-000000000001',location:'31000000-0000-4000-8000-000000000001',service:'41000000-0000-4000-8000-000000000001',pet:'51000000-0000-4000-8000-000000000001',slot:'61000000-0000-4000-8000-000000000001',hold:'71000000-0000-4000-8000-000000000001'};
      await client.query(`INSERT INTO identity_schema.users(id) VALUES($1)`,[id.owner]);
      await client.query(`INSERT INTO pet_schema.pets(id,owner_id,name,species) VALUES($1,$2,'W5 pet','DOG')`,[id.pet,id.owner]);
      await client.query(`INSERT INTO clinic_schema.clinics(id,legal_name,public_name) VALUES($1,'W5','W5')`,[id.clinic]);
      await client.query(`INSERT INTO clinic_schema.clinic_locations(id,clinic_id,address,timezone) VALUES($1,$2,'W5','Europe/Moscow')`,[id.location,id.clinic]);
      await client.query(`INSERT INTO clinic_schema.clinic_services(id,clinic_location_id,code,display_name,duration_minutes) VALUES($1,$2,'W5','W5',30)`,[id.service,id.location]);
      await client.query(`INSERT INTO clinic_schema.appointment_slots(id,clinic_location_id,service_id,starts_at,ends_at,capacity,held_count,booked_count,integration_mode) VALUES($1,$2,$3,clock_timestamp()+interval '1 day',clock_timestamp()+interval '1 day 30 minutes',1,0,1,'LEVEL_C')`,[id.slot,id.location,id.service]);
      await client.query(`INSERT INTO booking_schema.booking_holds(id,slot_id,owner_id,pet_id,state,expires_at) VALUES($1,$2,$3,$4,'CONFIRMED',clock_timestamp()+interval '1 day')`,[id.hold,id.slot,id.owner,id.pet]);
      const appointment=(await client.query(`INSERT INTO booking_schema.appointments(hold_id,owner_id,pet_id,clinic_location_id,slot_id,status) VALUES($1,$2,$3,$4,$5,'CONFIRMED') RETURNING id::text`,[id.hold,id.owner,id.pet,id.location,id.slot])).rows[0].id;

      run('up',target.toString());
      const first=(await client.query(`INSERT INTO booking_schema.booking_change_requests(request_type,booking_hold_id,appointment_id,owner_id,clinic_id,location_id,slot_id,idempotency_key,correlation_id) VALUES('CANCEL',$1,$2,$3,$4,$5,$6,gen_random_uuid(),gen_random_uuid()) RETURNING id::text`,[id.hold,appointment,id.owner,id.clinic,id.location,id.slot])).rows[0].id;
      await expect(client.query(`INSERT INTO booking_schema.booking_change_requests(request_type,booking_hold_id,appointment_id,owner_id,clinic_id,location_id,slot_id,idempotency_key,correlation_id) VALUES('RESCHEDULE',$1,$2,$3,$4,$5,$6,gen_random_uuid(),gen_random_uuid())`,[id.hold,appointment,id.owner,id.clinic,id.location,id.slot])).rejects.toMatchObject({code:'23505',constraint:'booking_change_requests_one_active_per_booking_idx'});
      await expect(client.query(`UPDATE booking_schema.booking_change_requests SET status='COMPLETED' WHERE id=$1`,[first])).rejects.toMatchObject({code:'23514',constraint:'booking_change_requests_terminal_check'});
      await client.query(`UPDATE booking_schema.booking_change_requests SET status='COMPLETED',terminal_at=clock_timestamp(),state_changed_at=clock_timestamp(),updated_at=clock_timestamp() WHERE id=$1`,[first]);
      await client.query(`INSERT INTO booking_schema.booking_change_requests(request_type,booking_hold_id,appointment_id,owner_id,clinic_id,location_id,slot_id,idempotency_key,correlation_id) VALUES('RESCHEDULE',$1,$2,$3,$4,$5,$6,gen_random_uuid(),gen_random_uuid())`,[id.hold,appointment,id.owner,id.clinic,id.location,id.slot]);
      await expect(client.query(`INSERT INTO booking_schema.booking_change_requests(request_type,status,terminal_at,booking_hold_id,appointment_id,owner_id,clinic_id,location_id,slot_id,idempotency_key,correlation_id) VALUES('CANCEL','REJECTED',clock_timestamp(),$1,$2,$3,gen_random_uuid(),$4,$5,gen_random_uuid(),gen_random_uuid())`,[id.hold,appointment,id.owner,id.location,id.slot])).rejects.toMatchObject({code:'23503'});

      await client.query(`INSERT INTO audit_schema.audit_log(actor_type,action,aggregate_type,aggregate_id,correlation_id,payload_json) VALUES('SYSTEM','w5.test','booking_change_request',$1,gen_random_uuid(),'{}')`,[first]);
      await client.query(`INSERT INTO booking_schema.outbox_events(event_type,producer,correlation_id,aggregate_type,aggregate_id,aggregate_version,payload_json,deduplication_key) VALUES('w5.test','test',gen_random_uuid(),'booking_change_request',$1,1,'{}',$2)`,[first,`w5.test:${first}`]);
      await client.query(`INSERT INTO booking_schema.idempotency_records(scope,idempotency_key,status,response_status,response_body,request_fingerprint) VALUES('booking.change-request:rollback-test',gen_random_uuid(),'COMPLETED',201,$1::jsonb,'test')`,[JSON.stringify({requestId:first})]);
      run('down',target.toString());
      expect((await client.query(`SELECT to_regclass('booking_schema.booking_change_requests') relation`)).rows[0].relation).toBeNull();
      expect((await client.query(`SELECT count(*)::int count FROM audit_schema.audit_log WHERE aggregate_id=$1`,[first])).rows[0].count).toBe(1);
      expect((await client.query(`SELECT count(*)::int count FROM booking_schema.outbox_events WHERE aggregate_id=$1`,[first])).rows[0].count).toBe(1);
      expect((await client.query(`SELECT count(*)::int count FROM booking_schema.idempotency_records WHERE scope='booking.change-request:rollback-test'`)).rows[0].count).toBe(1);
      run('up',target.toString());
      expect((await client.query(`SELECT count(*)::int count FROM public.schema_migrations WHERE name='1719560000000_add_booking_change_requests'`)).rows[0].count).toBe(1);
      expect((await client.query(`SELECT count(*)::int count FROM booking_schema.idempotency_records WHERE scope='booking.change-request:rollback-test'`)).rows[0].count).toBe(1);
    }finally{
      await client?.end(); await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1`,[name]); await admin.query(`DROP DATABASE IF EXISTS "${name}"`); await admin.end();
    }
  });
});

function run(direction:'up'|'down',databaseUrl:string){
  execFileSync(join(process.cwd(),'node_modules/.bin/node-pg-migrate'),[direction,'--migrations-dir','migrations/node-pg','--migrations-schema','public','--migrations-table','schema_migrations','--single-transaction'],{cwd:process.cwd(),env:{...process.env,DATABASE_URL:databaseUrl},stdio:'pipe'});
}
