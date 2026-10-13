import 'reflect-metadata';
import { Role } from '../src/auth/auth.types';
import { DatabaseService } from '../src/database/database.service';
import { ClinicEmployeeAccessService } from '../src/booking-core/clinic-employee-access.service';
import { ClinicWorkspaceHomeService } from '../src/booking-core/clinic-workspace-home.service';
import type { ClinicWorkspaceHomeTelemetry } from '../src/observability/clinic-workspace-home-telemetry';

// Opt-in against the retained, exclusively test-owned product demo fixture.
// No fixture deletion, reset, schema change or operational mutation.
const run = process.env.PRODUCT_DEMO_TEST === 'true' ? describe : describe.skip;
run('Product workspace real PostgreSQL authority regression', () => {
  let database: DatabaseService;
  let workspace: ClinicWorkspaceHomeService;
  const clinicId = '90000000-0000-4000-8000-000000000001';
  const locationId = '91000000-0000-4000-8000-000000000001';
  beforeAll(() => {
    if (new URL(process.env.DATABASE_URL!).pathname !== '/product_batch01') throw new Error('Exclusive product demo database required');
    database = new DatabaseService();
    workspace = new ClinicWorkspaceHomeService(database, new ClinicEmployeeAccessService(), { record: jest.fn() } as unknown as ClinicWorkspaceHomeTelemetry);
  });
  afterAll(async () => database?.onModuleDestroy());
  it('reads staff facts using real authority row locks and leaves operational rows unchanged', async () => {
    const fingerprint = async () => (await database.query(`SELECT (SELECT md5(string_agg(row_to_json(a)::text, ',' ORDER BY a.id)) FROM booking_schema.appointments a) AS appointments, (SELECT md5(string_agg(row_to_json(h)::text, ',' ORDER BY h.id)) FROM booking_schema.booking_holds h) AS holds`)).rows;
    const before = await fingerprint();
    const result = await workspace.read({ clinicId, locationId, employee: { sub: '33333333-3333-4333-8333-333333333333', roles: [Role.CLINIC_ADMIN], clinicIds: [clinicId], locationIds: [locationId] } });
    expect(result.sections[0].availability).toBe('AVAILABLE');
    expect(result.sections[2].availability).toBe('AVAILABLE');
    expect(await fingerprint()).toEqual(before);
  });
  it('keeps veterinarian facts restricted while permitting the authorized workspace', async () => {
    const result = await workspace.read({ clinicId, locationId, employee: { sub: '44444444-4444-4444-8444-444444444444', roles: [Role.CLINIC_VETERINARIAN], clinicIds: [clinicId], locationIds: [locationId] } });
    expect(result.sections.map(s => s.availability)).toEqual(['NOT_AUTHORIZED', 'NOT_AUTHORIZED', 'NOT_AUTHORIZED', 'NOT_CONFIGURED', 'NOT_AUTHORIZED']);
  });
  it('denies a forged clinic scope', async () => {
    await expect(workspace.read({ clinicId: '90000000-0000-4000-8000-000000000099', locationId, employee: { sub: '33333333-3333-4333-8333-333333333333', roles: [Role.CLINIC_ADMIN], clinicIds: [clinicId], locationIds: [locationId] } })).rejects.toMatchObject({ status: 403 });
  });
});
