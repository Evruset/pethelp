import { Client } from 'pg';

const ownerId = process.env.B01_OWNER_ID ?? '11111111-1111-4111-8111-111111111111';
const petId = process.env.B01_PET_ID ?? '22222222-2222-4222-8222-222222222222';

async function main(): Promise<void> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE clinic_schema.clinics CASCADE');
    await client.query('TRUNCATE pet_schema.pets, identity_schema.users CASCADE');
    await client.query('TRUNCATE booking_schema.outbox_events, booking_schema.idempotency_records, audit_schema.audit_log');

    await client.query('INSERT INTO identity_schema.users (id) VALUES ($1)', [ownerId]);
    await client.query(`INSERT INTO pet_schema.pets (id, owner_id, name, species) VALUES ($1, $2, 'B01 Test Pet', 'DOG')`, [petId, ownerId]);

    const clinic = await client.query<{ id: string }>(`INSERT INTO clinic_schema.clinics (legal_name, public_name) VALUES ('B01 Test Clinic LLC', 'B01 Test Clinic') RETURNING id`);
    const location = await client.query<{ id: string }>(`INSERT INTO clinic_schema.clinic_locations (clinic_id, address) VALUES ($1, 'B01 test address') RETURNING id`, [clinic.rows[0].id]);
    const service = await client.query<{ id: string }>(`INSERT INTO clinic_schema.clinic_services (clinic_location_id, code, display_name, duration_minutes) VALUES ($1, 'B01_VISIT', 'B01 visit', 30) RETURNING id`, [location.rows[0].id]);
    const slot = await client.query<{ id: string }>(`INSERT INTO clinic_schema.appointment_slots (clinic_location_id, service_id, starts_at, ends_at, capacity) VALUES ($1, $2, clock_timestamp() + interval '1 hour', clock_timestamp() + interval '90 minutes', 1) RETURNING id`, [location.rows[0].id, service.rows[0].id]);

    await client.query('COMMIT');
    process.stdout.write(JSON.stringify({ slotId: slot.rows[0].id, ownerId, petId }));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
