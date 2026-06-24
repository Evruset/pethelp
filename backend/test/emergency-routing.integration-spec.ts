import { randomUUID } from 'node:crypto';
import { Role } from '../src/auth/auth.types';
import { ClinicEmployeeAccessService } from '../src/booking-core/clinic-employee-access.service';
import { DatabaseService } from '../src/database/database.service';
import { EmergencyProfileService } from '../src/emergency-routing/emergency-profile.service';
import { EmergencyRoutingService } from '../src/emergency-routing/emergency-routing.service';

jest.setTimeout(30_000);

describe('Emergency routing capability profiles', () => {
  const database = new DatabaseService();
  const access = new ClinicEmployeeAccessService();
  const profiles = new EmergencyProfileService(database, access);
  const routing = new EmergencyRoutingService(database);

  afterAll(async () => {
    await database.onModuleDestroy();
  });

  it('returns only verified, accepting and fresh locations with every requested capability', async () => {
    const fixture = await createFixture(database);
    const admin = { sub: fixture.adminId, roles: [Role.CLINIC_ADMIN], locationIds: [fixture.acceptingLocationId] };

    await profiles.upsert(fixture.acceptingLocationId, {
      emergencyStatus: 'ACCEPTING_NOW',
      verificationStatus: 'VERIFIED',
      validUntil: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      capabilityVersion: 'alpha-1',
      emergencyContactPhone: '+79990000001',
      capabilities: [
        { capabilityCode: 'ICU', species: 'DOG', available24x7: true, source: 'CLINIC_VERIFIED' },
        { capabilityCode: 'TRAUMA', species: 'ALL', available24x7: true, source: 'CLINIC_VERIFIED' },
      ],
    }, admin);

    await database.query(`
      INSERT INTO clinic_schema.emergency_capability_profiles (
        clinic_location_id, accepts_emergency_now, emergency_status, verification_status,
        verified_at, valid_until, capability_version
      ) VALUES ($1::uuid, true, 'ACCEPTING_NOW', 'VERIFIED', clock_timestamp(), clock_timestamp() - interval '1 minute', 'expired-1')
    `, [fixture.expiredLocationId]);
    const expiredProfile = await database.query<{ id: string }>(`
      SELECT id::text FROM clinic_schema.emergency_capability_profiles WHERE clinic_location_id = $1::uuid
    `, [fixture.expiredLocationId]);
    await database.query(`
      INSERT INTO clinic_schema.emergency_capabilities (profile_id, capability_code, species, available_24x7, source)
      VALUES ($1::uuid, 'ICU', 'DOG', true, 'TEST')
    `, [expiredProfile.rows[0].id]);

    const candidates = await routing.search({
      species: 'DOG',
      requiredCapabilities: 'ICU,TRAUMA',
      latitude: '55.751244',
      longitude: '37.618423',
      limit: '10',
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      clinicLocationId: fixture.acceptingLocationId,
      emergencyContactPhone: '+79990000001',
      matchingCapabilities: ['ICU', 'TRAUMA'],
      straightLineDistanceKm: 0,
    });
  });

  it('rejects an accepting profile before it is verified', async () => {
    const fixture = await createFixture(database);
    const admin = { sub: fixture.adminId, roles: [Role.CLINIC_ADMIN], locationIds: [fixture.acceptingLocationId] };

    await expect(profiles.upsert(fixture.acceptingLocationId, {
      emergencyStatus: 'ACCEPTING_NOW',
      verificationStatus: 'PENDING',
      validUntil: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      capabilityVersion: 'alpha-1',
      capabilities: [{ capabilityCode: 'ICU', species: 'DOG', available24x7: true, source: 'TEST' }],
    }, admin)).rejects.toThrow('An accepting emergency profile must be verified');
  });
});

async function createFixture(database: DatabaseService): Promise<{
  adminId: string;
  acceptingLocationId: string;
  expiredLocationId: string;
}> {
  const adminId = randomUUID();
  await database.query('TRUNCATE clinic_schema.clinics CASCADE');
  await database.query('TRUNCATE identity_schema.users CASCADE');
  await database.query('INSERT INTO identity_schema.users (id) VALUES ($1::uuid)', [adminId]);

  const acceptingClinic = await database.query<{ id: string }>(`
    INSERT INTO clinic_schema.clinics (legal_name, public_name) VALUES ('Emergency Alpha LLC', 'Emergency Alpha') RETURNING id::text
  `);
  const acceptingLocation = await database.query<{ id: string }>(`
    INSERT INTO clinic_schema.clinic_locations (clinic_id, address, latitude, longitude)
    VALUES ($1::uuid, 'Emergency Alpha Address', 55.751244, 37.618423)
    RETURNING id::text
  `, [acceptingClinic.rows[0].id]);
  await database.query(`
    INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role)
    VALUES ($1::uuid, $2::uuid, 'CLINIC_ADMIN')
  `, [adminId, acceptingLocation.rows[0].id]);

  const expiredClinic = await database.query<{ id: string }>(`
    INSERT INTO clinic_schema.clinics (legal_name, public_name) VALUES ('Expired Emergency LLC', 'Expired Emergency') RETURNING id::text
  `);
  const expiredLocation = await database.query<{ id: string }>(`
    INSERT INTO clinic_schema.clinic_locations (clinic_id, address, latitude, longitude)
    VALUES ($1::uuid, 'Expired Emergency Address', 55.800000, 37.700000)
    RETURNING id::text
  `, [expiredClinic.rows[0].id]);

  return {
    adminId,
    acceptingLocationId: acceptingLocation.rows[0].id,
    expiredLocationId: expiredLocation.rows[0].id,
  };
}
