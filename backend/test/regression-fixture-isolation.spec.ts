import { renewRegressionClinicIds } from './helpers/regression-fixture-isolation';

describe('regression fixture isolation boundary', () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousAcceptance = process.env.WAVE4_ACCEPTANCE;
  const owned = 'postgres://vethelp:vethelp@postgres:5432/vethelp_wave3_reconcile_test_1';
  const fixture = () => ({ clinic: 'old-clinic', otherClinic: 'old-other', location: 'unchanged-location' });

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.WAVE4_ACCEPTANCE = 'true';
  });
  afterAll(() => {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousAcceptance === undefined) delete process.env.WAVE4_ACCEPTANCE;
    else process.env.WAVE4_ACCEPTANCE = previousAcceptance;
  });

  it('allocates distinct identities for every reset without changing other fixture scope', () => {
    const ids = fixture();
    renewRegressionClinicIds(ids, owned);
    const first = { ...ids };
    expect(ids.clinic).toMatch(/^[0-9a-f-]{36}$/);
    expect(ids.otherClinic).toMatch(/^[0-9a-f-]{36}$/);
    expect(ids.otherClinic).not.toBe(ids.clinic);
    renewRegressionClinicIds(ids, owned);
    expect(ids.clinic).not.toBe(first.clinic);
    expect(ids.otherClinic).not.toBe(first.otherClinic);
    expect(ids.location).toBe('unchanged-location');
  });

  it.each([
    'postgres://vethelp:vethelp@postgres:5432/vethelp',
    'postgres://vethelp:vethelp@postgres:5432/vethelp-alpha',
    'postgres://vethelp:vethelp@postgres:5432/vethelp_wave4a_final_gate_20261007',
    'postgres://vethelp:vethelp@postgres:5432/vethelp_wave3_final_gate_20261007',
    'postgres://vethelp:vethelp@postgres:5432/vethelp_wave4a_reconcile_base_08b',
    'postgres://vethelp:vethelp@localhost:5432/vethelp_wave3_reconcile_test_1',
    'https://postgres/vethelp_wave3_reconcile_test_1',
    'not-a-database-url',
  ])('rejects a non-owned target before changing fixture identity: %s', url => {
    const ids = fixture();
    expect(() => renewRegressionClinicIds(ids, url)).toThrow('REGRESSION_FIXTURE_DATABASE_NOT_OWNED');
    expect(ids).toEqual(fixture());
  });

  it.each(['NODE_ENV', 'WAVE4_ACCEPTANCE'])('requires explicit test acceptance: %s', name => {
    delete process.env[name];
    const ids = fixture();
    expect(() => renewRegressionClinicIds(ids, owned)).toThrow('REGRESSION_FIXTURE_DATABASE_NOT_OWNED');
    expect(ids).toEqual(fixture());
  });
});
