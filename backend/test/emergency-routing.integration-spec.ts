import { randomUUID } from 'node:crypto';
import { Role } from '../src/auth/auth.types';
import { ClinicEmployeeAccessService } from '../src/booking-core/clinic-employee-access.service';
import { DatabaseService } from '../src/database/database.service';
import { EmergencyOpsService } from '../src/emergency-routing/emergency-ops.service';
import { EmergencyProfileService } from '../src/emergency-routing/emergency-profile.service';
import { EmergencyPublicRoutingService } from '../src/emergency-routing/emergency-public-routing.service';

jest.setTimeout(30_000);

describe('Emergency public routing review gate', () => {
  const database = new DatabaseService();
  const access = new ClinicEmployeeAccessService();
  const profiles = new EmergencyProfileService(database, access);
  const ops = new EmergencyOpsService(database);
  const routing = new EmergencyPublicRoutingService(database);

  afterAll(async () => database.onModuleDestroy());

  it('requires profile declaration, active platform review and public flag before routing a clinic', async () => {
    const fixture = await fixtureFor(database);
    const clinicAdmin = { sub: fixture.clinicAdminId, roles: [Role.CLINIC_ADMIN], locationIds: [fixture.locationId] };
    await profiles.upsert(fixture.locationId, {
      emergencyStatus: 'ACCEPTING_NOW',
      verificationStatus: 'VERIFIED',
      validUntil: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      capabilityVersion: 'ops-gate-1',
      emergencyContactPhone: '+79990000001',
      capabilities: [
        { capabilityCode: 'ICU', species: 'DOG', available24x7: true, source: 'CLINIC_DECLARATION' },
        { capabilityCode: 'TRAUMA', species: 'ALL', available24x7: true, source: 'CLINIC_DECLARATION' },
      ],
    }, clinicAdmin);

    await expect(routing.search(query())).resolves.toEqual([]);
    const review = await ops.submitForReview(fixture.clinicId, 'https://evidence.sandbox.test/icu-license.pdf', clinicAdmin);
    await expect(routing.search(query())).resolves.toEqual([]);
    await ops.approveEmergencyProfile(review.reviewId, fixture.platformAdminId);

    const candidates = await routing.search(query());
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ clinicLocationId: fixture.locationId, matchingCapabilities: ['ICU', 'TRAUMA'], straightLineDistanceKm: 0 });

    await database.query("UPDATE clinic_schema.emergency_capabilities_reviews SET expires_at = clock_timestamp() - interval '1 minute' WHERE id = $1::uuid", [review.reviewId]);
    expect(await ops.expireOneDueReview()).toBe(true);
    await expect(routing.search(query())).resolves.toEqual([]);
  });
});

function query() { return { species: 'DOG', requiredCapabilities: 'ICU,TRAUMA', latitude: '55.751244', longitude: '37.618423', limit: '10' }; }

async function fixtureFor(database: DatabaseService): Promise<{ clinicId: string; clinicAdminId: string; platformAdminId: string; locationId: string }> {
  const clinicAdminId = randomUUID();
  const platformAdminId = randomUUID();
  await database.query('TRUNCATE clinic_schema.clinics CASCADE');
  await database.query('TRUNCATE identity_schema.users CASCADE');
  await database.query('INSERT INTO identity_schema.users (id) VALUES ($1::uuid), ($2::uuid)', [clinicAdminId, platformAdminId]);
  const clinic = await database.query<{ id: string }>("INSERT INTO clinic_schema.clinics (legal_name, public_name) VALUES ('Emergency Alpha LLC', 'Emergency Alpha') RETURNING id::text");
  const location = await database.query<{ id: string }>("INSERT INTO clinic_schema.clinic_locations (clinic_id, address, latitude, longitude) VALUES ($1::uuid, 'Emergency Alpha Address', 55.751244, 37.618423) RETURNING id::text", [clinic.rows[0].id]);
  await database.query("INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active) VALUES ($1::uuid, $2::uuid, 'CLINIC_ADMIN', true)", [clinicAdminId, location.rows[0].id]);
  return { clinicId: clinic.rows[0].id, clinicAdminId, platformAdminId, locationId: location.rows[0].id };
}
