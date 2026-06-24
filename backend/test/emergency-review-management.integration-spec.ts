import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../src/database/database.service';
import { EmergencyQueueRepository } from '../src/emergency-routing/emergency-queue.repository';
import { EmergencyReviewManagementService } from '../src/emergency-routing/emergency-review-management.service';

jest.setTimeout(30_000);

describe('Emergency reviewer queue and manual revoke', () => {
  const database = new DatabaseService();
  const queue = new EmergencyQueueRepository(database);
  const management = new EmergencyReviewManagementService(database, queue);

  afterAll(async () => database.onModuleDestroy());

  beforeEach(async () => {
    await database.query('TRUNCATE clinic_schema.clinics CASCADE');
    await database.query('TRUNCATE identity_schema.users CASCADE');
  });

  it('returns PENDING_REVIEW items in FIFO order with clinic evidence metadata', async () => {
    const fixture = await createFixture(database);
    await insertPendingReview(database, fixture.clinicId, 'https://evidence.test/older.pdf', "clock_timestamp() - interval '2 hours'");
    await insertPendingReview(database, fixture.secondClinicId, 'https://evidence.test/newer.pdf', "clock_timestamp() - interval '1 hour'");

    const page = await management.getPendingReviews(1, 20);

    expect(page.total).toBe(2);
    expect(page.items.map((item) => item.evidenceUrl)).toEqual([
      'https://evidence.test/older.pdf',
      'https://evidence.test/newer.pdf',
    ]);
    expect(page.items[0]).toMatchObject({ clinicId: fixture.clinicId, clinicName: 'Primary Clinic' });
    expect(page.items[0].queueAgeSeconds).toBeGreaterThan(page.items[1].queueAgeSeconds);
  });

  it('revokes active reviews, hides clinic, audits reason/correlation and emits routing event', async () => {
    const fixture = await createFixture(database);
    const reviewId = await insertVerifiedReview(database, fixture.clinicId, fixture.platformAdminId);
    const correlationId = randomUUID();

    const result = await management.revokeEmergencyCapabilities(
      fixture.clinicId,
      'Clinical evidence expired during manual compliance review',
      fixture.platformAdminId,
      correlationId,
    );

    expect(result).toEqual({ clinicId: fixture.clinicId, correlationId, revokedReviewIds: [reviewId], isEmergencyPublic: false });

    const clinic = await database.query<{ is_emergency_public: boolean }>('SELECT is_emergency_public FROM clinic_schema.clinics WHERE id = $1::uuid', [fixture.clinicId]);
    expect(clinic.rows[0].is_emergency_public).toBe(false);

    const review = await database.query<{ status: string }>('SELECT status FROM clinic_schema.emergency_capabilities_reviews WHERE id = $1::uuid', [reviewId]);
    expect(review.rows[0].status).toBe('REVOKED');

    const audit = await database.query<{ correlation_id: string; payload_json: { reason?: string } }>(`
      SELECT correlation_id::text, payload_json
      FROM audit_schema.audit_log
      WHERE action = 'EMERGENCY_CAPABILITIES_REVOKED' AND aggregate_id = $1::uuid
    `, [fixture.clinicId]);
    expect(audit.rows[0]).toMatchObject({ correlation_id: correlationId, payload_json: { reason: 'Clinical evidence expired during manual compliance review' } });

    const outbox = await database.query<{ event_type: string; correlation_id: string; payload_json: { clinicId?: string } }>(`
      SELECT event_type, correlation_id::text, payload_json
      FROM booking_schema.outbox_events
      WHERE event_type = 'clinic.emergency.revoked.v1' AND aggregate_id = $1::uuid
    `, [fixture.clinicId]);
    expect(outbox.rows[0]).toMatchObject({ event_type: 'clinic.emergency.revoked.v1', correlation_id: correlationId, payload_json: { clinicId: fixture.clinicId } });
  });
});

async function createFixture(database: DatabaseService): Promise<{ clinicId: string; secondClinicId: string; platformAdminId: string }> {
  const platformAdminId = randomUUID();
  await database.query('INSERT INTO identity_schema.users (id) VALUES ($1::uuid)', [platformAdminId]);
  const primary = await database.query<{ id: string }>("INSERT INTO clinic_schema.clinics (legal_name, public_name, is_emergency_public) VALUES ('Primary LLC', 'Primary Clinic', false) RETURNING id::text");
  const secondary = await database.query<{ id: string }>("INSERT INTO clinic_schema.clinics (legal_name, public_name, is_emergency_public) VALUES ('Secondary LLC', 'Secondary Clinic', false) RETURNING id::text");
  return { clinicId: primary.rows[0].id, secondClinicId: secondary.rows[0].id, platformAdminId };
}

async function insertPendingReview(database: DatabaseService, clinicId: string, evidenceUrl: string, createdAtExpression: string): Promise<void> {
  await database.query(`
    INSERT INTO clinic_schema.emergency_capabilities_reviews (clinic_id, status, evidence_url, created_at, updated_at)
    VALUES ($1::uuid, 'PENDING_REVIEW', $2::text, ${createdAtExpression}, ${createdAtExpression})
  `, [clinicId, evidenceUrl]);
}

async function insertVerifiedReview(database: DatabaseService, clinicId: string, platformAdminId: string): Promise<string> {
  return database.withTransaction(async (client) => {
    await client.query("SELECT set_config('vethelp.emergency_ops_actor', 'PLATFORM_ADMIN', true)");
    const result = await client.query<{ id: string }>(`
      INSERT INTO clinic_schema.emergency_capabilities_reviews (
        clinic_id, status, evidence_url, verified_by, expires_at
      ) VALUES ($1::uuid, 'VERIFIED', 'https://evidence.test/verified.pdf', $2::uuid, clock_timestamp() + interval '90 days')
      RETURNING id::text
    `, [clinicId, platformAdminId]);
    await client.query('UPDATE clinic_schema.clinics SET is_emergency_public = true WHERE id = $1::uuid', [clinicId]);
    return result.rows[0].id;
  });
}
