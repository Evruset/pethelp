import { randomUUID } from 'node:crypto';
import { Role } from '../src/auth/auth.types';
import { ClinicEmployeeAccessService } from '../src/booking-core/clinic-employee-access.service';
import { DatabaseService } from '../src/database/database.service';
import { EmergencyReviewCommand } from '../src/emergency-routing/emergency-review.command';
import { EmergencyProfileService } from '../src/emergency-routing/emergency-profile.service';
import { EmergencyRoutingService } from '../src/emergency-routing/emergency-routing.service';

jest.setTimeout(30_000);

describe('Emergency routing independent review boundary', () => {
  const database = new DatabaseService();
  const access = new ClinicEmployeeAccessService();
  const profiles = new EmergencyProfileService(database, access);
  const routing = new EmergencyRoutingService(database);
  const reviews = new EmergencyReviewCommand(database);

  afterAll(async () => database.onModuleDestroy());

  it('keeps clinic submissions out of public routing until platform review approves them', async () => {
    const fixture = await createFixture(database);
    const clinicAdmin = { sub: fixture.clinicAdminId, roles: [Role.CLINIC_ADMIN], locationIds: [fixture.locationId] };

    await profiles.upsert(fixture.locationId, {
      emergencyStatus: 'ACCEPTING_NOW',
      verificationStatus: 'VERIFIED',
      validUntil: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      capabilityVersion: 'alpha-2',
      emergencyContactPhone: '+79990000001',
      capabilities: [
        { capabilityCode: 'ICU', species: 'DOG', available24x7: true, source: 'CLINIC_DECLARATION' },
        { capabilityCode: 'TRAUMA', species: 'ALL', available24x7: true, source: 'CLINIC_DECLARATION' },
      ],
    }, clinicAdmin);

    const beforeReview = await routing.search({ species: 'DOG', requiredCapabilities: 'ICU,TRAUMA', latitude: '55.751244', longitude: '37.618423', limit: '10' });
    expect(beforeReview).toHaveLength(0);

    await reviews.execute(fixture.locationId, fixture.platformAdminId, 'VERIFIED', 'evidence checked');

    const candidates = await routing.search({ species: 'DOG', requiredCapabilities: 'ICU,TRAUMA', latitude: '55.751244', longitude: '37.618423', limit: '10' });
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ clinicLocationId: fixture.locationId, matchingCapabilities: ['ICU', 'TRAUMA'], straightLineDistanceKm: 0 });
  });

  it('never returns an expired profile even after approval', async () => {
    const fixture = await createFixture(database);
    await database.withTransaction(async (client) => {
      await client.query("SET LOCAL vethelp.emergency_review_actor = 'PLATFORM_ADMIN'");
      await client.query(`
        INSERT INTO clinic_schema.emergency_capability_profiles (
          clinic_location_id, accepts_emergency_now, emergency_status, verification_status, verified_at, valid_until, capability_version
        ) VALUES ($1::uuid, true, 'ACCEPTING_NOW', 'VERIFIED', clock_timestamp(), clock_timestamp() - interval '1 minute', 'expired')
      `, [fixture.locationId]);
    });
    const profile = await database.query<{ id: string }>('SELECT id::text FROM clinic_schema.emergency_capability_profiles WHERE clinic_location_id = $1::uuid', [fixture.locationId]);
    await database.query(`INSERT INTO clinic_schema.emergency_capabilities (profile_id, capability_code, species, available_24x7, source) VALUES ($1::uuid, 'ICU', 'DOG', true, 'TEST')`, [profile.rows[0].id]);
    await expect(routing.search({ species: 'DOG', requiredCapabilities: 'ICU', limit: '10' })).resolves.toEqual([]);
  });
});

async function createFixture(database: DatabaseService): Promise<{ clinicAdminId: string; platformAdminId: string; locationId: string }> {
  const clinicAdminId = randomUUID();
  const platformAdminId = randomUUID();
  await database.query('TRUNCATE clinic_schema.clinics CASCADE');
  await database.query('TRUNCATE identity_schema.users CASCADE');
  await database.query('INSERT INTO identity_schema.users (id) VALUES ($1::uuid), ($2::uuid)', [clinicAdminId, platformAdminId]);
  const clinic = await database.query<{ id: string }>(`INSERT INTO clinic_schema.clinics (legal_name, public_name) VALUES ('Emergency Alpha LLC', 'Emergency Alpha') RETURNING id::text`);
  const location = await database.query<{ id: string }>(`INSERT INTO clinic_schema.clinic_locations (clinic_id, address, latitude, longitude) VALUES ($1::uuid, 'Emergency Alpha Address', 55.751244, 37.618423) RETURNING id::text`, [clinic.rows[0].id]);
  await database.query(`INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role) VALUES ($1::uuid, $2::uuid, 'CLINIC_ADMIN')`, [clinicAdminId, location.rows[0].id]);
  return { clinicAdminId, platformAdminId, locationId: location.rows[0].id };
}
