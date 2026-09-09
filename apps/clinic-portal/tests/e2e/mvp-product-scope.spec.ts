import { expect, test } from '@playwright/test';

test.describe('PILOT_V1 product route containment', () => {
  test.skip(process.env.MVP_SCOPE_PROFILE !== 'PILOT_V1', 'pilot profile only');

  for (const path of [
    '/telemed/vet',
    '/clinics/clinic-1/locations/location-1/telemed',
    '/clinics/clinic-1/locations/location-1/quality',
    '/clinics/clinic-1/locations/location-1/vet/visits/visit-1/legacy-summary',
    '/api/telemed/vet/queue',
    '/api/clinic/clinic-1/locations/location-1/quality-dashboard',
    '/api/clinic/booking-holds/hold-1/alternative-slot?profile=LEGACY_COMPAT',
    '/api/clinic/visits/visit-1/results/result-1/delete',
  ]) {
    test(`returns 404 for ${path}`, async ({ request }) => {
      const response = await request.fetch(path);
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

  test('admits only the canonical Visit page and W7 Visit/Result BFF families', async ({ request }) => {
    const cookie = { cookie: 'vethelp_clinic_session=invalid-but-present' };
    for (const path of [
      '/clinics/clinic-1/locations/location-1/vet/visits',
      '/clinics/clinic-1/locations/location-1/vet/visits/hold-1',
      '/api/clinic/clinic-1/locations/location-1/vet/visits',
      '/api/clinic/clinic-1/locations/location-1/vet/visits/hold-1',
      '/api/clinic/booking-holds/hold-1/complete',
      '/api/clinic/visits/visit-1/results',
      '/api/clinic/visits/visit-1/results/result-1',
      '/api/clinic/visits/visit-1/results/result-1/publish',
      '/api/clinic/visits/visit-1/results/result-1/amendments',
    ]) {
      expect((await request.get(path, { headers: cookie })).status(), path).not.toBe(404);
    }
  });

  test('keeps missing and invalid sessions fail closed', async ({ request }) => {
    const page = await request.get('/clinics/clinic-1/locations/location-1/vet/visits', { maxRedirects: 0 });
    expect(page.status()).toBeGreaterThanOrEqual(300);
    expect(page.status()).toBeLessThan(400);
    const bff = await request.get('/api/clinic/clinic-1/locations/location-1/vet/visits', {
      headers: { cookie: 'vethelp_clinic_session=invalid-but-present' },
    });
    expect(bff.status()).toBe(403);
  });
});
