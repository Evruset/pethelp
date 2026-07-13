import assert from 'node:assert/strict';
import test from 'node:test';
import { hasCapability, hasClinicScope, parseEffectiveSession } from '../../lib/auth/effective-session.ts';

test('parses the effective session contract and drops malformed optional entries', () => {
  const session = parseEffectiveSession({ subjectId: 'employee-1', roles: ['CLINIC_RECEPTIONIST', 3], effectiveCapabilities: ['booking.queue.read', null], clinicScopes: [{ clinicId: 'clinic-1', locationId: 'location-1' }, { clinicId: 'broken' }] });
  assert.deepEqual(session, { subjectId: 'employee-1', roles: ['CLINIC_RECEPTIONIST'], effectiveCapabilities: ['booking.queue.read'], clinicScopes: [{ clinicId: 'clinic-1', locationId: 'location-1' }] });
});

test('capability and clinic/location selectors fail closed', () => {
  const session = parseEffectiveSession({ subjectId: 'employee-1', roles: [], effectiveCapabilities: ['booking.queue.read'], clinicScopes: [{ clinicId: 'clinic-1', locationId: 'location-1' }] });
  assert.equal(hasCapability(session, 'booking.queue.read'), true);
  assert.equal(hasCapability(session, 'quality.read'), false);
  assert.equal(hasCapability(null, 'booking.queue.read'), false);
  assert.equal(hasClinicScope(session, 'clinic-1', 'location-1'), true);
  assert.equal(hasClinicScope(session, 'clinic-1', 'location-2'), false);
});

test('quality.read requires both the capability and exact active clinic/location scope', () => {
  const session = parseEffectiveSession({ subjectId: 'employee-1', roles: [], effectiveCapabilities: ['quality.read'], clinicScopes: [{ clinicId: 'clinic-1', locationId: 'location-1' }] });
  assert.equal(hasCapability(session, 'quality.read') && hasClinicScope(session, 'clinic-1', 'location-1'), true);
  assert.equal(hasCapability(session, 'quality.read') && hasClinicScope(session, 'clinic-2', 'location-1'), false);
  assert.equal(hasCapability(session, 'quality.read') && hasClinicScope(session, 'clinic-1', 'location-2'), false);
});
