import { Client } from 'pg';

const ownerId = '11111111-1111-4111-8111-111111111111';
const petId = '22222222-2222-4222-8222-222222222222';
const ownerPhone = '+79991234567';

async function main(): Promise<void> {
  const client = new Client({ connectionString: process.env.DATABASE_URL ?? 'postgres://vethelp:vethelp@localhost:5432/vethelp' });
  await client.connect();
  try {
    await client.query('BEGIN');
    const collision = await client.query<{
      phone_user_id: string | null;
      pet_owner_id: string | null;
      owner_phone: string | null;
    }>(`
      SELECT
        (SELECT user_id::text FROM identity_schema.owner_identities WHERE phone_e164 = $2) AS phone_user_id,
        (SELECT owner_id::text FROM pet_schema.pets WHERE id = $3::uuid) AS pet_owner_id,
        (SELECT phone_e164 FROM identity_schema.owner_identities WHERE user_id = $1::uuid LIMIT 1) AS owner_phone
    `, [ownerId, ownerPhone, petId]);
    const existing = collision.rows[0];
    if ((existing?.phone_user_id && existing.phone_user_id !== ownerId) ||
        (existing?.pet_owner_id && existing.pet_owner_id !== ownerId) ||
        (existing?.owner_phone && existing.owner_phone !== ownerPhone)) {
      throw new Error('LOCAL_IDENTITIES_V1 ownership collision: fixed owner, phone, or pet is foreign.');
    }
    await client.query('INSERT INTO identity_schema.users (id) VALUES ($1::uuid) ON CONFLICT (id) DO NOTHING', [ownerId]);
    await client.query(`
      INSERT INTO identity_schema.owner_identities (user_id, phone_e164)
      VALUES ($1::uuid, $2)
      ON CONFLICT (phone_e164) DO UPDATE
      SET user_id = EXCLUDED.user_id
    `, [ownerId, ownerPhone]);
    await client.query(`
      INSERT INTO pet_schema.pets (id, owner_id, name, species, external_patient_id)
      VALUES ($1::uuid, $2::uuid, 'Demo Pet', 'DOG', 'mock-patient-222222222222')
      ON CONFLICT (id) DO UPDATE
      SET owner_id = EXCLUDED.owner_id, external_patient_id = EXCLUDED.external_patient_id
    `, [petId, ownerId]);
    await client.query('COMMIT');
    console.log(JSON.stringify({
      source: 'LOCAL_IDENTITIES_V1',
      ownerId,
      ownerPhone,
      petId,
      ownedIds: [ownerId, petId],
    }));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

void main();
