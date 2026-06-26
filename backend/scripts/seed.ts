import { Client } from 'pg';

const clinicName = 'VetHelp Pilot';
const clinicLegalName = 'VetHelp Pilot LLC';
const locationAddress = 'Moscow, Pilotnaya 1';
const serviceCode = 'GENERAL_VISIT';
const slotSource = 'LOCAL_BASE_SEED';
const fixtureHours = [9, 11, 15, 17] as const;
const dayOffsets = [0, 1, 2] as const;

type SlotRow = {
  id: string;
  starts_at: Date;
};

async function main(): Promise<void> {
  const client = new Client({
    connectionString: process.env.DATABASE_URL ?? 'postgres://vethelp:vethelp@localhost:5432/vethelp',
  });
  await client.connect();

  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL TIME ZONE 'UTC'");

    const clinic = await upsertClinic(client);
    const location = await upsertLocation(client, clinic.id);
    const service = await upsertService(client, location.id);
    const slotIds = await upsertRollingSlots(client, location.id, service.id);
    const emergency = await upsertEmergencyCapabilityFixture(client, location.id);

    await client.query('COMMIT');
    console.log(JSON.stringify({
      clinicId: clinic.id,
      locationId: location.id,
      serviceId: service.id,
      slotIds: slotIds.map((slot) => slot.id),
      emergencyProfileId: emergency.profileId,
      emergencyCapabilities: emergency.capabilities,
      devOwnerId: '11111111-1111-4111-8111-111111111111',
      devPetId: '22222222-2222-4222-8222-222222222222',
    }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

async function upsertClinic(client: Client): Promise<{ id: string }> {
  const existing = await client.query<{ id: string }>(
    'SELECT id FROM clinic_schema.clinics WHERE public_name = $1 ORDER BY created_at ASC, id ASC LIMIT 1 FOR UPDATE',
    [clinicName],
  );
  if (existing.rows[0]) {
    await client.query(`
      UPDATE clinic_schema.clinics
      SET legal_name = $2,
          status = 'ACTIVE',
          timezone = 'Europe/Moscow',
          mis_type = 'VET_MANAGER_API',
          updated_at = clock_timestamp()
      WHERE id = $1::uuid
    `, [existing.rows[0].id, clinicLegalName]);
    return existing.rows[0];
  }

  const created = await client.query<{ id: string }>(`
    INSERT INTO clinic_schema.clinics (legal_name, public_name, status, timezone, mis_type)
    VALUES ($1, $2, 'ACTIVE', 'Europe/Moscow', 'VET_MANAGER_API')
    RETURNING id
  `, [clinicLegalName, clinicName]);
  return created.rows[0];
}

async function upsertLocation(client: Client, clinicId: string): Promise<{ id: string }> {
  const existing = await client.query<{ id: string }>(`
    SELECT id
    FROM clinic_schema.clinic_locations
    WHERE clinic_id = $1::uuid AND address = $2
    ORDER BY created_at ASC, id ASC
    LIMIT 1
    FOR UPDATE
  `, [clinicId, locationAddress]);
  if (existing.rows[0]) {
    await client.query(`
      UPDATE clinic_schema.clinic_locations
      SET latitude = 55.7558,
          longitude = 37.6173,
          phone = '+7 495 000-00-00',
          status = 'ACTIVE',
          updated_at = clock_timestamp()
      WHERE id = $1::uuid
    `, [existing.rows[0].id]);
    return existing.rows[0];
  }

  const created = await client.query<{ id: string }>(`
    INSERT INTO clinic_schema.clinic_locations (clinic_id, address, latitude, longitude, phone, status)
    VALUES ($1::uuid, $2, 55.7558, 37.6173, '+7 495 000-00-00', 'ACTIVE')
    RETURNING id
  `, [clinicId, locationAddress]);
  return created.rows[0];
}

async function upsertService(client: Client, locationId: string): Promise<{ id: string }> {
  const service = await client.query<{ id: string }>(`
    INSERT INTO clinic_schema.clinic_services (
      clinic_location_id,
      code,
      display_name,
      duration_minutes,
      active,
      price_amount,
      currency
    )
    VALUES ($1::uuid, $2, 'Initial visit', 30, true, 1000.00, 'RUB')
    ON CONFLICT (clinic_location_id, code) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        duration_minutes = EXCLUDED.duration_minutes,
        active = true,
        price_amount = EXCLUDED.price_amount,
        currency = EXCLUDED.currency
    RETURNING id
  `, [locationId, serviceCode]);
  return service.rows[0];
}

async function upsertRollingSlots(client: Client, locationId: string, serviceId: string): Promise<SlotRow[]> {
  const slots: SlotRow[] = [];
  for (const dayOffset of dayOffsets) {
    const calendarKey = new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10)
      .replaceAll('-', '');

    for (const hour of fixtureHours) {
      const externalSlotId = `base-${calendarKey}-${hour}`;
      const result = await client.query<SlotRow>(`
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
          booked_count,
          held_count,
          state,
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
          0,
          0,
          'OPEN',
          $5,
          $6,
          'LEVEL_A',
          clock_timestamp()
        FROM fixture_time
        WHERE fixture_time.starts_at > clock_timestamp() + interval '30 minutes'
        ON CONFLICT (source, external_slot_id) DO UPDATE
        SET clinic_location_id = EXCLUDED.clinic_location_id,
            service_id = EXCLUDED.service_id,
            starts_at = EXCLUDED.starts_at,
            ends_at = EXCLUDED.ends_at,
            capacity = GREATEST(clinic_schema.appointment_slots.capacity, EXCLUDED.capacity),
            state = CASE
              WHEN clinic_schema.appointment_slots.booked_count > 0 THEN clinic_schema.appointment_slots.state
              ELSE 'OPEN'
            END,
            integration_mode = 'LEVEL_A',
            last_freshness_sync = clock_timestamp(),
            updated_at = clock_timestamp()
        RETURNING id, starts_at
      `, [
        locationId,
        serviceId,
        dayOffset,
        hour,
        slotSource,
        externalSlotId,
      ]);
      if (result.rows[0]) slots.push(result.rows[0]);
    }
  }
  return slots;
}

async function upsertEmergencyCapabilityFixture(
  client: Client,
  locationId: string,
): Promise<{ profileId: string; capabilities: string[] }> {
  await client.query("SELECT set_config('vethelp.emergency_review_actor', 'PLATFORM_ADMIN', true)");
  const profile = await client.query<{ id: string }>(`
    INSERT INTO clinic_schema.emergency_capability_profiles (
      clinic_location_id,
      accepts_emergency_now,
      emergency_status,
      status_updated_at,
      verification_status,
      verified_at,
      valid_until,
      capability_version,
      emergency_contact_phone
    )
    VALUES (
      $1::uuid,
      true,
      'ACCEPTING_NOW',
      clock_timestamp(),
      'VERIFIED',
      clock_timestamp(),
      clock_timestamp() + interval '30 days',
      'local-dev-v1',
      '+7 495 000-00-01'
    )
    ON CONFLICT (clinic_location_id) DO UPDATE
    SET accepts_emergency_now = true,
        emergency_status = 'ACCEPTING_NOW',
        status_updated_at = clock_timestamp(),
        verification_status = 'VERIFIED',
        verified_at = clock_timestamp(),
        valid_until = clock_timestamp() + interval '30 days',
        capability_version = 'local-dev-v1',
        emergency_contact_phone = '+7 495 000-00-01',
        updated_at = clock_timestamp()
    RETURNING id
  `, [locationId]);

  const capabilities = ['OXYGEN_SUPPORT', 'TRAUMA', 'TOXICOLOGY'];
  for (const capability of capabilities) {
    await client.query(`
      INSERT INTO clinic_schema.emergency_capabilities (
        profile_id,
        capability_code,
        species,
        available_24x7,
        source,
        evidence_reference
      )
      VALUES ($1::uuid, $2, 'ALL', true, 'LOCAL_SEED', 'local-dev-fixture')
      ON CONFLICT (profile_id, capability_code, species) DO UPDATE
      SET available_24x7 = true,
          source = 'LOCAL_SEED',
          evidence_reference = 'local-dev-fixture'
    `, [profile.rows[0].id, capability]);
  }

  return { profileId: profile.rows[0].id, capabilities };
}

void main();
