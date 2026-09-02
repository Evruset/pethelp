import { NotFoundException } from '@nestjs/common';
import { assertMvpProductRoute, isPilotBackendRouteAllowed } from './mvp-product-scope.guard';
import { resolveMvpScope } from './mvp-scope.config';

describe('MVP product route containment', () => {
  it.each([
    '/v1/booking-holds/hold-1/alternative',
    '/v1/booking-holds/hold-1/alternative/accept',
    '/v1/booking-holds/hold-1/release',
    '/v1/booking-holds/hold-1/cancellation-requests',
    '/v1/clinic/booking-holds/hold-1/alternative-slot',
    '/v1/clinic/clinic-1/locations/location-1/quality-dashboard',
    '/v1/clinic/clinic-1/locations/location-1/vet/visits/hold-1/legacy-summary',
    '/v1/clinic/visits/visit-1/results/result-1/delete',
    '/v1/clinic/clinic-1/locations/location-1/booking-holds/hold-1/audit-trail',
  ])('classifies %s as outside the pilot surface', (path) => {
    expect(isPilotBackendRouteAllowed(path)).toBe(false);
  });

  it.each([
    '/v1/clinic/clinic-1/locations/location-1/booking-queue',
    '/v1/clinic/clinic-1/locations/location-1/schedule/slots',
    '/v1/clinic/clinic-1/locations/location-1/patients',
    '/v1/owner/appointments',
    '/v1/catalog/clinics',
  ])('keeps %s in the pilot surface', (path) => {
    expect(isPilotBackendRouteAllowed(path)).toBe(true);
  });

  it.each([
    '/v1/clinic/clinic-1/locations/location-1/vet/visits',
    '/v1/clinic/clinic-1/locations/location-1/vet/visits/hold-1',
    '/v1/clinic/booking-holds/hold-1/complete',
    '/v1/clinic/visits/visit-1/results',
    '/v1/clinic/visits/visit-1/results/result-1',
    '/v1/clinic/visits/visit-1/results/result-1/publish',
    '/v1/clinic/visits/visit-1/results/result-1/amendments',
  ])('admits the exact W7 Visit/Result route %s', (path) => {
    expect(isPilotBackendRouteAllowed(path)).toBe(true);
  });

  it('returns a normalized 404 before a blocked handler can execute', () => {
    const pilot = resolveMvpScope({ MVP_SCOPE_PROFILE: 'PILOT_V1' } as NodeJS.ProcessEnv);
    expect(() => assertMvpProductRoute(pilot, '/v1/clinic/booking-holds/hold-1/alternative-slot')).toThrow(NotFoundException);
  });

  it('preserves legacy cancellation routes outside PILOT_V1', () => {
    const legacy = resolveMvpScope({ MVP_SCOPE_PROFILE: 'LEGACY_COMPAT' } as NodeJS.ProcessEnv);
    expect(assertMvpProductRoute(legacy, '/v1/booking-holds/hold-1/release')).toBe(true);
    expect(assertMvpProductRoute(legacy, '/v1/booking-holds/hold-1/cancellation-requests')).toBe(true);
  });

  it('contains mature Pet mutations while preserving the minimal read route', () => {
    const legacy = resolveMvpScope({ MVP_SCOPE_PROFILE: 'LEGACY_COMPAT' } as NodeJS.ProcessEnv);
    expect(isPilotBackendRouteAllowed('/v1/owner/pets/pet-id', 'GET')).toBe(true);
    expect(isPilotBackendRouteAllowed('/v1/owner/pets/pet-id/diary', 'GET')).toBe(true);
    expect(isPilotBackendRouteAllowed('/v1/owner/pets/pet-id', 'PATCH')).toBe(false);
    expect(isPilotBackendRouteAllowed('/v1/owner/pets/pet-id/archive', 'POST')).toBe(false);
    expect(isPilotBackendRouteAllowed('/v1/owner/pets/pet-id/documents', 'POST')).toBe(false);
    expect(assertMvpProductRoute(legacy, '/v1/owner/pets/pet-id', 'PATCH')).toBe(true);
  });
});
