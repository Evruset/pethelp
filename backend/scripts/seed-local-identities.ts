import { Client } from 'pg';

const ownerId = '11111111-1111-4111-8111-111111111111';
const petId = '22222222-2222-4222-8222-222222222222';

async function main(): Promise<void> {
  const client = new Client({ connectionString: process.env.DATABASE_URL ?? 'postgres://vethelp:vethelp@localhost:5432/vethelp' });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO identity_schema.users (id) VALUES ($1::uuid) ON CONFLICT (id) DO NOTHING', [ownerId]);
    await client.query(`
      INSERT INTO pet_schema.pets (id, owner_id, name, species, external_patient_id)
      VALUES ($1::uuid, $2::uuid, 'Demo Pet', 'DOG', 'mock-patient-22222222')
      ON CONFLICT (id) DO UPDATE
      SET owner_id = EXCLUDED.owner_id, external_patient_id = EXCLUDED.external_patient_id
    `, [petId, ownerId]);
    await client.query('COMMIT');
    console.log(JSON.stringify({ ownerId, petId }));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

void main();
