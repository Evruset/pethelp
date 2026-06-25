import { Client } from 'pg';

const employeeId = '33333333-3333-4333-8333-333333333333';

async function main(): Promise<void> {
  const client = new Client({
    connectionString:
      process.env.DATABASE_URL ?? 'postgres://vethelp:vethelp@localhost:5432/vethelp',
  });

  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'INSERT INTO identity_schema.users (id) VALUES ($1::uuid) ON CONFLICT (id) DO NOTHING',
      [employeeId],
    );

    const location = await client.query<{ clinic_id: string; location_id: string }>(`
      SELECT clinic.id AS clinic_id, location.id AS location_id
      FROM clinic_schema.clinics clinic
      JOIN clinic_schema.clinic_locations location ON location.clinic_id = clinic.id
      WHERE clinic.public_name = 'VetHelp Pilot'
      ORDER BY location.created_at ASC, location.id ASC
      LIMIT 1
    `);
    const row = location.rows[0];
    if (!row) {
      throw new Error('VetHelp Pilot clinic location was not found. Run the seed profile first.');
    }

    await client.query(
      `
        INSERT INTO clinic_schema.employee_location_memberships
          (employee_id, clinic_location_id, role, active, revoked_at)
        VALUES ($1::uuid, $2::uuid, 'CLINIC_RECEPTIONIST', true, NULL)
        ON CONFLICT (employee_id, clinic_location_id) DO UPDATE
        SET role = EXCLUDED.role,
            active = true,
            revoked_at = NULL,
            updated_at = clock_timestamp()
      `,
      [employeeId, row.location_id],
    );

    await client.query('COMMIT');
    console.log(
      JSON.stringify({
        employeeId,
        clinicId: row.clinic_id,
        locationId: row.location_id,
        role: 'CLINIC_RECEPTIONIST',
      }),
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

void main();
