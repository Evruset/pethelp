import { Client } from 'pg';

async function main(): Promise<void> {
  const client = new Client({ connectionString: process.env.DATABASE_URL ?? 'postgres://vethelp:vethelp@localhost:5432/vethelp' });
  await client.connect();
  try {
    await client.query('BEGIN');
    const clinic = await client.query<{ id: string }>(`
      INSERT INTO clinic_schema.clinics (legal_name, public_name)
      VALUES ('VetHelp Pilot LLC', 'VetHelp Pilot')
      RETURNING id
    `);
    const location = await client.query<{ id: string }>(`
      INSERT INTO clinic_schema.clinic_locations (clinic_id, address, latitude, longitude, phone)
      VALUES ($1, 'Moscow, Pilotnaya 1', 55.7558, 37.6173, '+7 495 000-00-00')
      RETURNING id
    `, [clinic.rows[0].id]);
    const service = await client.query<{ id: string }>(`
      INSERT INTO clinic_schema.clinic_services (clinic_location_id, code, display_name, duration_minutes)
      VALUES ($1, 'GENERAL_VISIT', 'Initial visit', 30)
      RETURNING id
    `, [location.rows[0].id]);
    const slots = await client.query<{ id: string }>(`
      INSERT INTO clinic_schema.appointment_slots (clinic_location_id, service_id, starts_at, ends_at, capacity)
      SELECT $1, $2, clock_timestamp() + (n || ' hours')::interval,
             clock_timestamp() + (n || ' hours')::interval + interval '30 minutes', 1
      FROM generate_series(2, 5) n
      RETURNING id
    `, [location.rows[0].id, service.rows[0].id]);
    await client.query('COMMIT');
    console.log(JSON.stringify({
      clinicId: clinic.rows[0].id,
      locationId: location.rows[0].id,
      slotIds: slots.rows.map((slot) => slot.id),
      devOwnerId: '11111111-1111-4111-8111-111111111111',
      devPetId: '22222222-2222-4222-8222-222222222222'
    }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

void main();
