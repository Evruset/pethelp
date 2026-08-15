import { expect, test } from '@playwright/test';

test.describe('PILOT_V1 product route containment', () => {
  test.skip(process.env.MVP_SCOPE_PROFILE !== 'PILOT_V1', 'pilot profile only');

  for (const path of [
    '/telemed/vet',
    '/clinics/clinic-1/locations/location-1/telemed',
    '/clinics/clinic-1/locations/location-1/quality',
    '/clinics/clinic-1/locations/location-1/vet/visits',
    '/api/telemed/vet/queue',
    '/api/clinic/clinic-1/locations/location-1/quality-dashboard',
    '/api/clinic/booking-holds/hold-1/alternative-slot?profile=LEGACY_COMPAT',
    '/api/clinic/booking-holds/hold-1/complete',
  ]) {
    test(`returns 404 for ${path}`, async ({ request }) => {
      const response = await request.fetch(path, { method: path.endsWith('complete') ? 'POST' : 'GET' });
      expect(response.status()).toBe(404);
      expect(await response.text()).not.toContain('MVP_SCOPE_PROFILE');
    });
  }

  test('keeps Queue, Schedule and Patients pages registered', async ({ request }) => {
    for (const path of [
      '/clinics/clinic-1/locations/location-1/queue',
      '/clinics/clinic-1/locations/location-1/schedule',
      '/clinics/clinic-1/locations/location-1/patients',
    ]) {
      expect((await request.get(path, {
        headers: { cookie: 'vethelp_clinic_session=invalid-but-present' },
      })).status()).not.toBe(404);
    }
  });
});
