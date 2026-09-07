import { execFileSync } from 'node:child_process';
import { Client } from 'pg';

jest.setTimeout(180_000);

describe('doctor public-profile consent migration', () => {
  it('migrates cleanly and enforces authorized, ordered, append-only consent events', async () => {
    await withDatabase(async (client, databaseUrl) => {
      const migration = runMigrations(databaseUrl);
      if (!migration.ok) throw new Error(migration.output);
      const ids = {
        clinic: '61000000-0000-0000-0000-000000000001',
        location: '61000000-0000-0000-0000-000000000002',
        doctor: '61000000-0000-0000-0000-000000000003',
        secondDoctor: '61000000-0000-0000-0000-000000000004',
        concurrentDoctor: '61000000-0000-0000-0000-000000000007',
        transitionDoctor: '61000000-0000-0000-0000-000000000008',
        admin: '61000000-0000-0000-0000-000000000005',
        veterinarian: '61000000-0000-0000-0000-000000000006',
      };
      const specialtyId = (await client.query<{ id: string }>('SELECT id FROM catalog_schema.specialties ORDER BY code LIMIT 1')).rows[0].id;
      await client.query('INSERT INTO identity_schema.users(id) VALUES ($1),($2)', [ids.admin, ids.veterinarian]);
      await client.query("INSERT INTO clinic_schema.clinics(id,legal_name,public_name) VALUES ($1,'Consent Clinic','Consent Clinic')", [ids.clinic]);
      await client.query("INSERT INTO clinic_schema.clinic_locations(id,clinic_id,address,timezone) VALUES ($1,$2,'Consent address','Europe/Moscow')", [ids.location, ids.clinic]);
      await client.query(`INSERT INTO clinic_schema.employee_location_memberships(employee_id,clinic_location_id,role)
        VALUES ($1,$3,'CLINIC_ADMIN'),($2,$3,'CLINIC_VETERINARIAN')`, [ids.admin, ids.veterinarian, ids.location]);
      await client.query(`INSERT INTO catalog_schema.doctors(id,clinic_location_id,full_name,specialty_id)
        VALUES ($1,$5,'Consent Doctor',$6),($2,$5,'Second Doctor',$6),
          ($3,$5,'Concurrent Doctor',$6),($4,$5,'Transition Doctor',$6)`,
      [ids.doctor, ids.secondDoctor, ids.concurrentDoctor, ids.transitionDoctor, ids.location, specialtyId]);

      expect((await client.query('SELECT count(*)::int count FROM catalog_schema.doctor_public_profile_consent_events WHERE doctor_id=$1', [ids.doctor])).rows[0].count).toBe(0);
      await expect(insertEvent(client, ids.doctor, ids.location, ids.veterinarian, 'CONSENT_GRANTED', '2 seconds')).rejects.toMatchObject({ code: '23514' });
      await expect(insertEvent(client, ids.doctor, ids.location, ids.admin, 'CONSENT_REVOKED', '2 seconds')).rejects.toMatchObject({ code: '23514' });

      const granted = await insertEvent(client, ids.doctor, ids.location, ids.admin, 'CONSENT_GRANTED', '2 seconds');
      await expect(insertEvent(client, ids.doctor, ids.location, ids.admin, 'CONSENT_GRANTED', '1 second')).rejects.toMatchObject({ code: '23514' });
      const revoked = await insertEvent(client, ids.doctor, ids.location, ids.admin, 'CONSENT_REVOKED', '1 second');
      expect((await client.query('SELECT event_type FROM catalog_schema.doctor_public_profile_consent_events WHERE doctor_id=$1 ORDER BY occurred_at DESC,id DESC LIMIT 1', [ids.doctor])).rows[0].event_type).toBe('CONSENT_REVOKED');
      await expect(insertEvent(client, ids.doctor, ids.location, ids.admin, 'CONSENT_GRANTED', '3 seconds')).rejects.toMatchObject({ code: '23514' });
      await expect(client.query('UPDATE catalog_schema.doctor_public_profile_consent_events SET actor_id=$1 WHERE id=$2', [ids.veterinarian, granted])).rejects.toMatchObject({ code: '23514' });
      await expect(client.query('DELETE FROM catalog_schema.doctor_public_profile_consent_events WHERE id=$1', [revoked])).rejects.toMatchObject({ code: '23514' });

      await client.query("UPDATE clinic_schema.employee_location_memberships SET active=false,revoked_at=clock_timestamp() WHERE employee_id=$1 AND clinic_location_id=$2", [ids.admin, ids.location]);
      await expect(insertEvent(client, ids.secondDoctor, ids.location, ids.admin, 'CONSENT_GRANTED', '1 second')).rejects.toMatchObject({ code: '23514' });
      await client.query("UPDATE clinic_schema.employee_location_memberships SET active=true,revoked_at=NULL WHERE employee_id=$1 AND clinic_location_id=$2", [ids.admin, ids.location]);

      const concurrentA = new Client({ connectionString: databaseUrl }); const concurrentB = new Client({ connectionString: databaseUrl });
      await Promise.all([concurrentA.connect(), concurrentB.connect()]);
      try {
        const duplicateGrants = await Promise.allSettled([
          insertEvent(concurrentA, ids.concurrentDoctor, ids.location, ids.admin, 'CONSENT_GRANTED', '1 second'),
          insertEvent(concurrentB, ids.concurrentDoctor, ids.location, ids.admin, 'CONSENT_GRANTED', '1 second'),
        ]);
        expect(duplicateGrants.filter(result => result.status === 'fulfilled')).toHaveLength(1);
        expect((await client.query('SELECT event_type FROM catalog_schema.doctor_public_profile_consent_events WHERE doctor_id=$1', [ids.concurrentDoctor])).rows.map(row => row.event_type)).toEqual(['CONSENT_GRANTED']);

        const grantRevoke = await Promise.allSettled([
          insertEvent(concurrentA, ids.transitionDoctor, ids.location, ids.admin, 'CONSENT_GRANTED', '1 second'),
          insertEvent(concurrentB, ids.transitionDoctor, ids.location, ids.admin, 'CONSENT_REVOKED', '500 milliseconds'),
        ]);
        expect(grantRevoke[0].status).toBe('fulfilled');
        const transitions = (await client.query('SELECT event_type FROM catalog_schema.doctor_public_profile_consent_events WHERE doctor_id=$1 ORDER BY occurred_at,id', [ids.transitionDoctor])).rows.map(row => row.event_type);
        expect([['CONSENT_GRANTED'], ['CONSENT_GRANTED', 'CONSENT_REVOKED']]).toContainEqual(transitions);
      } finally {
        await Promise.all([concurrentA.end(), concurrentB.end()]);
      }
    });
  });
});

async function insertEvent(client: Client, doctorId: string, locationId: string, actorId: string, eventType: string, ago: string) {
  const result = await client.query<{ id: string }>(`INSERT INTO catalog_schema.doctor_public_profile_consent_events
    (doctor_id,clinic_location_id,event_type,actor_id,occurred_at)
    VALUES ($1,$2,$3,$4,clock_timestamp()-($5::text)::interval) RETURNING id`, [doctorId, locationId, eventType, actorId, ago]);
  return result.rows[0].id;
}

function runMigrations(databaseUrl: string) {
  try {
    const output = execFileSync('npm', ['run', 'migrate:up'], { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: databaseUrl }, encoding: 'utf8', stdio: 'pipe' });
    return { ok: true, output };
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string };
    return { ok: false, output: `${failure.stdout ?? ''}${failure.stderr ?? ''}` };
  }
}

async function withDatabase(run: (client: Client, databaseUrl: string) => Promise<void>) {
  const configured = process.env.DATABASE_URL;
  if (!configured) throw new Error('DATABASE_URL is required');
  const admin = new Client({ connectionString: configured });
  const name = `vethelp_doctor_consent_${process.pid}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const target = new URL(configured); target.pathname = `/${name}`;
  let client: Client | null = null;
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    client = new Client({ connectionString: target.toString() }); await client.connect();
    await run(client, target.toString());
  } finally {
    await client?.end();
    await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1', [name]);
    await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
    await admin.end();
  }
}
