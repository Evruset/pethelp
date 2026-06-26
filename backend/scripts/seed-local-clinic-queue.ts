import { Client } from 'pg';

const ownerId = '11111111-1111-4111-8111-111111111111';
const petId = '22222222-2222-4222-8222-222222222222';
const fixtureSource = 'LOCAL_DEV_QUEUE_FIXTURE';

type FixtureItem = {
  holdId: string;
  slotId: string;
  startsAt: string;
  confirmationSlaExpiresAt: string;
};

const fixturePlan = [
  { startsInHours: 2, pendingForMinutes: 12, slaInMinutes: 2 },
  { startsInHours: 3, pendingForMinutes: 6, slaInMinutes: 10 },
  { startsInHours: 4, pendingForMinutes: 2, slaInMinutes: 14 },
] as const;

async function main(): Promise<void> {
  const client = new Client({
    connectionString: process.env.DATABASE_URL ?? 'postgres://vethelp:vethelp@localhost:5432/vethelp',
  });

  await client.connect();
  try {
    await client.query('BEGIN');

    const pilot = await client.query<{
      clinic_id: string;
      location_id: string;
      service_id: string;
    }>(`
      SELECT c.id AS clinic_id, l.id AS location_id, s.id AS service_id
      FROM clinic_schema.clinics c
      JOIN clinic_schema.clinic_locations l
        ON l.clinic_id = c.id AND l.status = 'ACTIVE'
      JOIN clinic_schema.clinic_services s
        ON s.clinic_location_id = l.id AND s.active = true
      WHERE c.public_name = 'VetHelp Pilot'
      ORDER BY s.code ASC
      LIMIT 1
      FOR SHARE OF c, l, s
    `);

    const target = pilot.rows[0];
    if (!target) {
      throw new Error('VetHelp Pilot clinic/location/service was not found. Run the normal local seed first.');
    }

    const identity = await client.query<{ owner_exists: boolean; pet_exists: boolean }>(`
      SELECT
        EXISTS(SELECT 1 FROM identity_schema.users WHERE id = $1::uuid) AS owner_exists,
        EXISTS(SELECT 1 FROM pet_schema.pets WHERE id = $2::uuid AND owner_id = $1::uuid) AS pet_exists
    `, [ownerId, petId]);

    if (!identity.rows[0]?.owner_exists || !identity.rows[0]?.pet_exists) {
      throw new Error('Local demo owner/pet is missing. Run seed-local-identities.ts first.');
    }

    const runId = `${Date.now()}-${process.pid}`;
    const created: FixtureItem[] = [];

    await client.query(`
      DELETE FROM booking_schema.booking_holds hold
      USING clinic_schema.appointment_slots slot
      WHERE hold.slot_id = slot.id
        AND slot.source = $1
        AND NOT EXISTS (
          SELECT 1
          FROM booking_schema.appointments appointment
          WHERE appointment.hold_id = hold.id
        )
    `, [fixtureSource]);
    await client.query(`
      DELETE FROM clinic_schema.appointment_slots slot
      WHERE slot.source = $1
        AND NOT EXISTS (
          SELECT 1
          FROM booking_schema.booking_holds hold
          WHERE hold.slot_id = slot.id
        )
    `, [fixtureSource]);

    for (const [index, fixture] of fixturePlan.entries()) {
      const slot = await client.query<{ id: string; starts_at: Date }>(`
        INSERT INTO clinic_schema.appointment_slots (
          clinic_location_id,
          service_id,
          starts_at,
          ends_at,
          capacity,
          booked_count,
          held_count,
          state,
          source,
          external_slot_id,
          integration_mode,
          status,
          last_freshness_sync
        )
        VALUES (
          $1::uuid,
          $2::uuid,
          clock_timestamp() + make_interval(hours => $3::int),
          clock_timestamp() + make_interval(hours => $3::int) + interval '30 minutes',
          1,
          0,
          1,
          'OPEN',
          $4,
          $5,
          'LEVEL_C',
          'LOCKED_BY_HOLD',
          clock_timestamp()
        )
        RETURNING id, starts_at
      `, [
        target.location_id,
        target.service_id,
        fixture.startsInHours,
        fixtureSource,
        `clinic-queue-${runId}-${index + 1}`,
      ]);

      const createdSlot = slot.rows[0];
      const hold = await client.query<{
        id: string;
        confirmation_sla_expires_at: Date;
      }>(`
        INSERT INTO booking_schema.booking_holds (
          slot_id,
          owner_id,
          pet_id,
          state,
          expires_at,
          confirmation_sla_expires_at,
          state_changed_at,
          version,
          created_at,
          updated_at
        )
        VALUES (
          $1::uuid,
          $2::uuid,
          $3::uuid,
          'MANUAL_CONFIRM_PENDING',
          clock_timestamp() + interval '30 minutes',
          clock_timestamp() + ($4::int * interval '1 minute'),
          clock_timestamp() - ($5::int * interval '1 minute'),
          1,
          clock_timestamp(),
          clock_timestamp()
        )
        RETURNING id, confirmation_sla_expires_at
      `, [
        createdSlot.id,
        ownerId,
        petId,
        fixture.slaInMinutes,
        fixture.pendingForMinutes,
      ]);

      created.push({
        holdId: hold.rows[0].id,
        slotId: createdSlot.id,
        startsAt: createdSlot.starts_at.toISOString(),
        confirmationSlaExpiresAt: hold.rows[0].confirmation_sla_expires_at.toISOString(),
      });
    }

    await client.query('COMMIT');
    console.log(JSON.stringify({
      clinicId: target.clinic_id,
      locationId: target.location_id,
      source: fixtureSource,
      items: created,
      notes: [
        'Items are ordered by manualConfirmPendingAt for backend FIFO validation.',
        'The first row enters critical SLA state immediately; later rows keep 10 and 14 minutes.',
      ],
    }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

void main();
