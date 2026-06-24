import { randomUUID } from 'node:crypto';
import { Role } from '../src/auth/auth.types';
import { DatabaseService } from '../src/database/database.service';
import { EmergencyOpsService } from '../src/emergency-routing/emergency-ops.service';

jest.setTimeout(30_000);

describe('Emergency Ops lifecycle', () => {
  const database = new DatabaseService();
  const service = new EmergencyOpsService(database);

  afterAll(async () => database.onModuleDestroy());

  it('submits, approves, expires and hides an emergency clinic atomically', async () => {
    const fixture = await createFixture(database);
    const submission = await service.submitForReview(
      fixture.clinicId,
      'https://evidence.sandbox.test/licenses/icu.pdf',
      { sub: fixture.clinicAdminId, roles: [Role.CLINIC_ADMIN], locationIds: [fixture.locationId] },
    );
    expect(submission.status).toBe('PENDING_REVIEW');

    const hidden = await database.query<{ is_emergency_public: boolean }>('SELECT is_emergency_public FROM clinic_schema.clinics WHERE id = $1::uuid', [fixture.clinicId]);
    expect(hidden.rows[0].is_emergency_public).toBe(false);

    const approved = await service.approveEmergencyProfile(submission.reviewId, fixture.platformAdminId);
    expect(approved.status).toBe('VERIFIED');
    expect(approved.expiresAt).toBeTruthy();

    const visible = await database.query<{ is_emergency_public: boolean; status: string }>(`
      SELECT c.is_emergency_public, r.status
      FROM clinic_schema.clinics c
      JOIN clinic_schema.emergency_capabilities_reviews r ON r.clinic_id = c.id
      WHERE r.id = $1::uuid
    `, [submission.reviewId]);
    expect(visible.rows[0]).toEqual({ is_emergency_public: true, status: 'VERIFIED' });

    await database.query(`
      UPDATE clinic_schema.emergency_capabilities_reviews
      SET expires_at = clock_timestamp() - interval '1 minute'
      WHERE id = $1::uuid
    `, [submission.reviewId]);

    expect(await service.expireOneDueReview()).toBe(true);

    const expired = await database.query<{ status: string; is_emergency_public: boolean }>(`
      SELECT r.status, c.is_emergency_public
      FROM clinic_schema.emergency_capabilities_reviews r
      JOIN clinic_schema.clinics c ON c.id = r.clinic_id
      WHERE r.id = $1::uuid
    `, [submission.reviewId]);
    expect(expired.rows[0]).toEqual({ status: 'EXPIRED', is_emergency_public: false });

    const alert = await database.query<{ payload_json: { alert_type?: string } }>(`
      SELECT payload_json
      FROM booking_schema.outbox_events
      WHERE event_type = 'alert.stale_emergency_profile.v1'
        AND aggregate_id = $1::uuid
    `, [fixture.clinicId]);
    expect(alert.rows[0].payload_json.alert_type).toBe('STALE_EMERGENCY_PROFILE');
  });
});

async function createFixture(database: DatabaseService): Promise<{ clinicId: string; locationId: string; clinicAdminId: string; platformAdminId: string }> {
  const clinicAdminId = randomUUID();
  const platformAdminId = randomUUID();
  await database.query('TRUNCATE clinic_schema.clinics CASCADE');
  await database.query('TRUNCATE identity_schema.users CASCADE');
  await database.query('INSERT INTO identity_schema.users (id) VALUES ($1::uuid), ($2::uuid)', [clinicAdminId, platformAdminId]);
  const clinic = await database.query<{ id: string }>(`INSERT INTO clinic_schema.clinics (legal_name, public_name) VALUES ('Emergency Ops LLC', 'Emergency Ops') RETURNING id::text`);
  const location = await database.query<{ id: string }>(`INSERT INTO clinic_schema.clinic_locations (clinic_id, address) VALUES ($1::uuid, 'Ops address') RETURNING id::text`, [clinic.rows[0].id]);
  await database.query(`INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role) VALUES ($1::uuid, $2::uuid, 'CLINIC_ADMIN')`, [clinicAdminId, location.rows[0].id]);
  await database.withTransaction(async (client) => {
    await client.query("SELECT set_config('vethelp.emergency_review_actor', 'PLATFORM_ADMIN', true)");
    await client.query(`
      INSERT INTO clinic_schema.emergency_capability_profiles (
        clinic_location_id, accepts_emergency_now, emergency_status, verification_status,
        verified_at, valid_until, capability_version
      ) VALUES ($1::uuid, true, 'ACCEPTING_NOW', 'VERIFIED', clock_timestamp(), clock_timestamp() + interval '120 days', 'ops-fixture')
    `, [location.rows[0].id]);
  });
  return { clinicId: clinic.rows[0].id, locationId: location.rows[0].id, clinicAdminId, platformAdminId };
}
