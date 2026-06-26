import { Client } from 'pg';

const fixtureSource = 'LOCAL_DEV_OWNER_MARKETPLACE';
const fixtureTimes = [10, 13, 16, 19] as const;
const daysAhead = [0, 1, 2] as const;

type SeededSlot = {
  id: string;
  startsAt: string;
};

async function main(): Promise<void> {
  const client = new Client({
    connectionString: process.env.DATABASE_URL ?? 'postgres://vethelp:vethelp@localhost:5432/vethelp',
  });
  await client.connect();

  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL TIME ZONE 'UTC'");
    const target = await client.query<{
      clinic_id: string;
      location_id: string;
      service_id: string;
    }>(`
      SELECT clinic.id AS clinic_id, location.id AS location_id, service.id AS service_id
      FROM clinic_schema.clinics clinic
      JOIN clinic_schema.clinic_locations location
        ON location.clinic_id = clinic.id
       AND location.status = 'ACTIVE'
      JOIN clinic_schema.clinic_services service
        ON service.clinic_location_id = location.id
       AND service.active = true
      WHERE clinic.public_name = 'VetHelp Pilot'
      ORDER BY service.code ASC
      LIMIT 1
      FOR SHARE OF clinic, location, service
    `);
    const pilot = target.rows[0];
    if (!pilot) {
      throw new Error('VetHelp Pilot clinic/location/service was not found. Run npm run seed on a fresh database first.');
    }

    const seeded: SeededSlot[] = [];
    for (const dayOffset of daysAhead) {
      const calendarKey = new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10)
        .replaceAll('-', '');
      for (const hour of fixtureTimes) {
        const externalSlotId = `owner-marketplace-${calendarKey}-${hour}`;
        const result = await client.query<{ id: string; starts_at: Date }>(`
          WITH fixture_time AS (
            SELECT date_trunc('day', clock_timestamp())
                   + make_interval(days => $3::int, hours => $4::int) AS starts_at
          )
          INSERT INTO clinic_schema.appointment_slots (
            clinic_location_id,
            service_id,
            starts_at,
            ends_at,
            capacity,
            source,
            external_slot_id,
            integration_mode,
            last_freshness_sync
          )
          SELECT
            $1::uuid,
            $2::uuid,
            fixture_time.starts_at,
            fixture_time.starts_at + interval '30 minutes',
            1,
            $5,
            $6,
            'LEVEL_A',
            clock_timestamp()
          FROM fixture_time
          WHERE fixture_time.starts_at > clock_timestamp() + interval '30 minutes'
          ON CONFLICT (source, external_slot_id) DO UPDATE
          SET service_id = EXCLUDED.service_id,
              integration_mode = 'LEVEL_A',
              last_freshness_sync = clock_timestamp(),
              updated_at = clock_timestamp()
          RETURNING id, starts_at
        `, [
          pilot.location_id,
          pilot.service_id,
          dayOffset,
          hour,
          fixtureSource,
          externalSlotId,
        ]);
        if (result.rows[0]) {
          seeded.push({
            id: result.rows[0].id,
            startsAt: result.rows[0].starts_at.toISOString(),
          });
        }
      }
    }

    const active = await client.query<{ id: string; starts_at: Date }>(`
      SELECT id, starts_at
      FROM clinic_schema.appointment_slots
      WHERE clinic_location_id = $1::uuid
        AND source = $2
        AND state = 'OPEN'
        AND starts_at > clock_timestamp()
        AND capacity - booked_count - held_count > 0
      ORDER BY starts_at
    `, [pilot.location_id, fixtureSource]);

    await client.query('COMMIT');
    console.log(JSON.stringify({
      clinicId: pilot.clinic_id,
      locationId: pilot.location_id,
      source: fixtureSource,
      createdSlots: seeded,
      availableSlots: active.rows.map((slot) => ({
        id: slot.id,
        startsAt: slot.starts_at.toISOString(),
      })),
    }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

void main();
