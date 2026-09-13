import { Client } from 'pg';

const SOURCE = 'LOCAL_OWNER_R2J_ACCEPTANCE_V1';
const ownerId = '11111111-1111-4111-8111-111111111111';
const petId = '22222222-2222-4222-8222-222222222222';

const slots = {
  active: '7a200000-0000-4000-8000-000000000001',
  actionOriginal: '7a200000-0000-4000-8000-000000000002',
  actionAlternative: '7a200000-0000-4000-8000-000000000003',
  history: '7a200000-0000-4000-8000-000000000004',
} as const;

const holds = {
  active: '7a300000-0000-4000-8000-000000000001',
  action: '7a300000-0000-4000-8000-000000000002',
  history: '7a300000-0000-4000-8000-000000000003',
} as const;

async function main(): Promise<void> {
  const client = new Client({
    connectionString: process.env.DATABASE_URL ?? 'postgres://vethelp:vethelp@localhost:5432/vethelp',
  });

  await client.connect();
  try {
    await client.query('BEGIN');

    const target = await client.query<{ location_id: string; service_id: string }>(`
      SELECT l.id AS location_id, s.id AS service_id
      FROM clinic_schema.clinics c
      JOIN clinic_schema.clinic_locations l
        ON l.clinic_id = c.id AND l.status = 'ACTIVE'
      JOIN clinic_schema.clinic_services s
        ON s.clinic_location_id = l.id AND s.active = true
      WHERE c.public_name = 'VetHelp Pilot'
      ORDER BY s.code, l.id
      LIMIT 1
      FOR SHARE OF c, l, s
    `);
    if (!target.rows[0]) throw new Error('VetHelp Pilot clinic/location/service missing. Run the normal local seed first.');

    const identity = await client.query<{ owner_exists: boolean; pet_exists: boolean }>(`
      SELECT
        EXISTS(SELECT 1 FROM identity_schema.users WHERE id=$1::uuid) AS owner_exists,
        EXISTS(SELECT 1 FROM pet_schema.pets WHERE id=$2::uuid AND owner_id=$1::uuid) AS pet_exists
    `, [ownerId, petId]);
    if (!identity.rows[0]?.owner_exists || !identity.rows[0]?.pet_exists) {
      throw new Error('Canonical local Owner/Pet is missing. Run the Owner seed first.');
    }

    const slotIds = Object.values(slots);
    const holdIds = Object.values(holds);

    const collisions = await client.query<{ id: string; source: string }>(`
      SELECT id::text, source
      FROM clinic_schema.appointment_slots
      WHERE id = ANY($1::uuid[])
        AND source <> $2
      ORDER BY id
    `, [slotIds, SOURCE]);
    if (collisions.rows.length) {
      throw new Error(`${SOURCE} slot namespace collision: ${collisions.rows.map((row) => `${row.id}:${row.source}`).join(',')}`);
    }

    const holdCollisions = await client.query<{ id: string }>(`
      SELECT hold.id::text
      FROM booking_schema.booking_holds hold
      WHERE hold.id = ANY($1::uuid[])
        AND (hold.owner_id <> $2::uuid OR hold.pet_id <> $3::uuid)
      ORDER BY hold.id
    `, [holdIds, ownerId, petId]);
    if (holdCollisions.rows.length) {
      throw new Error(`${SOURCE} hold namespace collision: ${holdCollisions.rows.map((row) => row.id).join(',')}`);
    }

    await client.query(`
      SELECT hold.id
      FROM booking_schema.booking_holds hold
      WHERE hold.id = ANY($1::uuid[])
      ORDER BY hold.id
      FOR UPDATE
    `, [holdIds]);
    await client.query(`
      SELECT slot.id
      FROM clinic_schema.appointment_slots slot
      WHERE slot.id = ANY($1::uuid[])
      ORDER BY slot.id
      FOR UPDATE
    `, [slotIds]);
    await client.query(`
      SELECT event.id
      FROM booking_schema.outbox_events event
      WHERE event.aggregate_type='booking_hold'
        AND event.aggregate_id = ANY($1::uuid[])
      ORDER BY event.id
      FOR UPDATE
    `, [holdIds]);

    await client.query(`
      DELETE FROM booking_schema.owner_notification_email_deliveries delivery
      USING booking_schema.owner_notifications notification
      WHERE delivery.notification_id=notification.id
        AND notification.booking_hold_id = ANY($1::uuid[])
    `, [holdIds]);
    await client.query(`DELETE FROM booking_schema.owner_notifications WHERE booking_hold_id = ANY($1::uuid[])`, [holdIds]);
    await client.query(`DELETE FROM booking_schema.appointment_events WHERE hold_id = ANY($1::uuid[])`, [holdIds]);
    await client.query(`DELETE FROM booking_schema.alternative_swap_groups WHERE original_hold_id = ANY($1::uuid[])`, [holdIds]);
    await client.query(`DELETE FROM telemed_schema.telemed_sessions WHERE booking_hold_id = ANY($1::uuid[])`, [holdIds]);
    await client.query(`
      DELETE FROM payment_schema.ledger_entries entry
      WHERE entry.payment_intent_id IN (
        SELECT intent.id FROM payment_schema.payment_intents intent WHERE intent.hold_id = ANY($1::uuid[])
      )
    `, [holdIds]);
    await client.query(`
      DELETE FROM payment_schema.provider_webhook_events event
      WHERE event.payment_intent_id IN (
        SELECT intent.id FROM payment_schema.payment_intents intent WHERE intent.hold_id = ANY($1::uuid[])
      )
    `, [holdIds]);
    await client.query(`DELETE FROM payment_schema.payment_intents WHERE hold_id = ANY($1::uuid[])`, [holdIds]);
    await client.query(`DELETE FROM booking_schema.outbox_events WHERE aggregate_type='booking_hold' AND aggregate_id = ANY($1::uuid[])`, [holdIds]);
    await client.query(`DELETE FROM booking_schema.booking_holds WHERE id = ANY($1::uuid[])`, [holdIds]);
    await client.query(`DELETE FROM clinic_schema.appointment_slots WHERE id = ANY($1::uuid[])`, [slotIds]);

    const { location_id: locationId, service_id: serviceId } = target.rows[0];

    const slotPlan = [
      [slots.active, 'r2j-active', 4, 1],
      [slots.actionOriginal, 'r2j-action-original', 5, 1],
      [slots.actionAlternative, 'r2j-action-alternative', 6, 0],
      [slots.history, 'r2j-history', -3, 0],
    ] as const;

    for (const [id, externalSlotId, startsInHours, heldCount] of slotPlan) {
      await client.query(`
        INSERT INTO clinic_schema.appointment_slots (
          id, clinic_location_id, service_id, starts_at, ends_at,
          capacity, booked_count, held_count, state, source, external_slot_id,
          version, status, integration_mode, last_freshness_sync, created_at, updated_at
        ) VALUES (
          $1::uuid,$2::uuid,$3::uuid,
          clock_timestamp()+make_interval(hours=>$4::int),
          clock_timestamp()+make_interval(hours=>$4::int)+interval '30 minutes',
          1,0,$5,'OPEN',$6,$7,1,
          CASE WHEN $5::int>0 THEN 'LOCKED_BY_HOLD' ELSE 'AVAILABLE' END,
          'LEVEL_C',clock_timestamp(),clock_timestamp(),clock_timestamp()
        )
      `, [id, locationId, serviceId, startsInHours, heldCount, SOURCE, externalSlotId]);
    }

    await client.query(`
      INSERT INTO booking_schema.booking_holds (
        id,slot_id,owner_id,pet_id,state,expires_at,confirmation_sla_expires_at,
        alternative_slot_id,alternative_expires_at,state_changed_at,version,created_at,updated_at
      ) VALUES (
        $1::uuid,$2::uuid,$3::uuid,$4::uuid,'MANUAL_CONFIRM_PENDING',
        clock_timestamp()+interval '12 hours',clock_timestamp()+interval '11 hours',
        NULL,NULL,clock_timestamp(),1,clock_timestamp(),clock_timestamp()
      )
    `, [holds.active, slots.active, ownerId, petId]);

    await client.query(`
      INSERT INTO booking_schema.booking_holds (
        id,slot_id,owner_id,pet_id,state,expires_at,confirmation_sla_expires_at,
        alternative_slot_id,alternative_expires_at,state_changed_at,version,created_at,updated_at
      ) VALUES (
        $1::uuid,$2::uuid,$3::uuid,$4::uuid,'ALTERNATIVE_PENDING',
        clock_timestamp()+interval '12 hours',NULL,
        $5::uuid,clock_timestamp()+interval '2 hours',clock_timestamp(),1,clock_timestamp(),clock_timestamp()
      )
    `, [holds.action, slots.actionOriginal, ownerId, petId, slots.actionAlternative]);

    await client.query(`
      INSERT INTO booking_schema.booking_holds (
        id,slot_id,owner_id,pet_id,state,expires_at,confirmation_sla_expires_at,
        alternative_slot_id,alternative_expires_at,state_changed_at,version,created_at,updated_at
      ) VALUES (
        $1::uuid,$2::uuid,$3::uuid,$4::uuid,'EXPIRED',
        clock_timestamp()-interval '2 hours',NULL,NULL,NULL,
        clock_timestamp()-interval '90 minutes',1,
        clock_timestamp()-interval '3 hours',clock_timestamp()
      )
    `, [holds.history, slots.history, ownerId, petId]);

    await client.query('COMMIT');

    console.log(JSON.stringify({
      source: SOURCE,
      schemaVersion: 1,
      ownerId,
      petId,
      slots,
      holds,
      expectedBuckets: {
        requiresAction: [holds.action],
        active: [holds.active],
        history: [holds.history],
      },
    }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

void main();
