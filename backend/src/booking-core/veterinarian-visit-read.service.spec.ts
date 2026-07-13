import { Role } from '../auth/auth.types';
import { VeterinarianVisitReadService } from './veterinarian-visit-read.service';

const CLINIC = '00000000-0000-4000-8000-000000000002';
const LOCATION = '00000000-0000-4000-8000-000000000003';
const ACTOR = { sub: '00000000-0000-4000-8000-000000000001', roles: [Role.CLINIC_VETERINARIAN], clinicIds: [CLINIC], locationIds: [LOCATION] };

describe('VeterinarianVisitReadService list projection', () => {
  it('returns only the allow-listed visit fields after centralized authorization', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{
      hold_id: '00000000-0000-4000-8000-000000000004', clinic_id: CLINIC, location_id: LOCATION,
      starts_at: new Date('2026-01-02T10:00:00.000Z'), ends_at: new Date('2026-01-02T10:30:00.000Z'),
      state: 'CONFIRMED', pet_name: 'Milo', species: 'CAT', owner_phone: '+79990000000',
    }] });
    const access = { assertClinicalVisitWorkspaceReadAccess: jest.fn().mockResolvedValue(undefined) };
    const database = { withTransaction: (work: (client: unknown) => Promise<unknown>) => work({ query }) };
    const service = new VeterinarianVisitReadService(database as never, access as never);

    await expect(service.list(CLINIC, LOCATION, ACTOR)).resolves.toEqual([{
      holdId: '00000000-0000-4000-8000-000000000004', clinicId: CLINIC, locationId: LOCATION,
      scheduledStart: '2026-01-02T10:00:00.000Z', scheduledEnd: '2026-01-02T10:30:00.000Z',
      status: 'CONFIRMED', petDisplayName: 'Milo', species: 'CAT',
    }]);
    expect(access.assertClinicalVisitWorkspaceReadAccess).toHaveBeenCalledWith(expect.anything(), ACTOR, CLINIC, LOCATION);
    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain("h.state IN ('CONFIRMED', 'COMPLETED')");
    expect(sql).toContain('l.clinic_id = $1::uuid');
    expect(sql).toContain('s.clinic_location_id = $2::uuid');
    expect(sql).not.toContain('owner');
  });
});

describe('VeterinarianVisitReadService detail projection', () => {
  it('uses the same bounded projection and normalizes an absent or out-of-scope row', async () => {
    const query = jest.fn().mockResolvedValueOnce({ rows: [{
      hold_id: '00000000-0000-4000-8000-000000000004', clinic_id: CLINIC, location_id: LOCATION,
      starts_at: new Date('2026-01-02T10:00:00.000Z'), ends_at: new Date('2026-01-02T10:30:00.000Z'),
      state: 'COMPLETED', pet_name: 'Milo', species: 'CAT',
    }] }).mockResolvedValueOnce({ rows: [] });
    const access = { assertClinicalVisitWorkspaceReadAccess: jest.fn().mockResolvedValue(undefined) };
    const database = { withTransaction: (work: (client: unknown) => Promise<unknown>) => work({ query }) };
    const service = new VeterinarianVisitReadService(database as never, access as never);

    await expect(service.detail(CLINIC, LOCATION, '00000000-0000-4000-8000-000000000004', ACTOR)).resolves.toMatchObject({
      holdId: '00000000-0000-4000-8000-000000000004', status: 'COMPLETED', petDisplayName: 'Milo',
    });
    await expect(service.detail(CLINIC, LOCATION, '00000000-0000-4000-8000-000000000005', ACTOR)).rejects.toMatchObject({ response: { code: 'CLINIC_SCOPE_MISMATCH' } });
    expect(query.mock.calls[0][0]).toContain("h.state IN ('CONFIRMED', 'COMPLETED')");
    expect(query.mock.calls[0][0]).toContain('h.id = $1::uuid');
  });
});
