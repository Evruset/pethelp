import type { PoolClient } from 'pg';
import { Role } from './auth.types';
import { Capability } from './capability';
import { CapabilityEvaluatorService } from './capability-evaluator.service';
import { DomainException } from '../common/domain-error';

const ACTOR = '00000000-0000-4000-8000-000000000001';
const CLINIC = '00000000-0000-4000-8000-000000000002';
const LOCATION = '00000000-0000-4000-8000-000000000003';
const OTHER_LOCATION = '00000000-0000-4000-8000-000000000004';

function client(active = true): Pick<PoolClient, 'query'> {
  return { query: jest.fn().mockResolvedValue({ rows: active ? [{ employee_id: ACTOR }] : [] }) } as unknown as Pick<PoolClient, 'query'>;
}

describe('CapabilityEvaluatorService booking.queue.read ABAC matrix', () => {
  const evaluator = new CapabilityEvaluatorService();
  const resource = { aggregateType: 'booking.queue' as const, clinicId: CLINIC, locationId: LOCATION };

  it('allows receptionist with matching claims and active membership', async () => {
    await expect(evaluator.assertAllowed(client() as PoolClient, { actor: { sub: ACTOR, roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [CLINIC], locationIds: [LOCATION] }, capability: Capability.BOOKING_QUEUE_READ, resource })).resolves.toBeUndefined();
  });

  it.each([
    ['wrong role', { sub: ACTOR, roles: [Role.CLINIC_VETERINARIAN], clinicIds: [CLINIC], locationIds: [LOCATION] }],
    ['cross clinic claim', { sub: ACTOR, roles: [Role.CLINIC_ADMIN], clinicIds: [OTHER_LOCATION], locationIds: [LOCATION] }],
    ['cross location claim', { sub: ACTOR, roles: [Role.CLINIC_ADMIN], clinicIds: [CLINIC], locationIds: [OTHER_LOCATION] }],
  ])('denies %s before membership query', async (_name, actor) => {
    const db = client();
    await expect(evaluator.assertAllowed(db as PoolClient, { actor, capability: Capability.BOOKING_QUEUE_READ, resource })).rejects.toBeInstanceOf(DomainException);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('denies revoked membership after claim checks', async () => {
    await expect(evaluator.assertAllowed(client(false) as PoolClient, { actor: { sub: ACTOR, roles: [Role.CLINIC_ADMIN], clinicIds: [CLINIC], locationIds: [LOCATION] }, capability: Capability.BOOKING_QUEUE_READ, resource })).rejects.toBeInstanceOf(DomainException);
  });
});

describe('CapabilityEvaluatorService clinical.visit.workspace.read ABAC matrix', () => {
  const evaluator = new CapabilityEvaluatorService();
  const resource = { aggregateType: 'clinical.visit.workspace' as const, clinicId: CLINIC, locationId: LOCATION };
  const veterinarian = { sub: ACTOR, roles: [Role.CLINIC_VETERINARIAN], clinicIds: [CLINIC], locationIds: [LOCATION] };

  it('allows an active scoped clinic veterinarian', async () => {
    await expect(evaluator.assertAllowed(client() as PoolClient, {
      actor: veterinarian, capability: Capability.CLINICAL_VISIT_WORKSPACE_READ, resource,
    })).resolves.toBeUndefined();
  });

  it.each([
    ['clinic admin', { ...veterinarian, roles: [Role.CLINIC_ADMIN] }],
    ['receptionist', { ...veterinarian, roles: [Role.CLINIC_RECEPTIONIST] }],
    ['JWT capability-shaped claim without role grant', { ...veterinarian, roles: [] }],
    ['clinic mismatch', { ...veterinarian, clinicIds: [OTHER_LOCATION] }],
    ['location mismatch', { ...veterinarian, locationIds: [OTHER_LOCATION] }],
  ])('denies %s before membership query', async (_name, actor) => {
    const db = client();
    await expect(evaluator.assertAllowed(db as PoolClient, {
      actor, capability: Capability.CLINICAL_VISIT_WORKSPACE_READ, resource,
    })).rejects.toMatchObject({ response: { code: 'CLINIC_SCOPE_MISMATCH' } });
    expect(db.query).not.toHaveBeenCalled();
  });

  it.each(['inactive', 'revoked'])('normalizes %s membership denial', async () => {
    await expect(evaluator.assertAllowed(client(false) as PoolClient, {
      actor: veterinarian, capability: Capability.CLINICAL_VISIT_WORKSPACE_READ, resource,
    })).rejects.toMatchObject({ response: { code: 'CLINIC_SCOPE_MISMATCH' } });
  });
});

describe('CapabilityEvaluatorService ops.slo.snapshot.read platform authority', () => {
  const evaluator = new CapabilityEvaluatorService();
  const resource = { aggregateType: 'ops.slo.snapshot' as const, authorityModel: 'platform' as const };

  it('allows platform admin without clinic or location claims', async () => {
    const db = client();
    await expect(evaluator.assertAllowed(db as PoolClient, {
      actor: { sub: ACTOR, roles: [Role.PLATFORM_ADMIN] },
      capability: Capability.OPS_SLO_SNAPSHOT_READ,
      resource,
    })).resolves.toBeUndefined();
    expect(db.query).not.toHaveBeenCalled();
  });

  it('does not treat clinic or location claims as platform authority', async () => {
    const db = client();
    await expect(evaluator.assertAllowed(db as PoolClient, {
      actor: { sub: ACTOR, roles: [Role.PLATFORM_ADMIN], clinicIds: [CLINIC], locationIds: [LOCATION] },
      capability: Capability.OPS_SLO_SNAPSHOT_READ,
      resource,
    })).resolves.toBeUndefined();
    expect(db.query).not.toHaveBeenCalled();
  });

  it('denies a role without the platform capability before querying membership', async () => {
    const db = client();
    await expect(evaluator.assertAllowed(db as PoolClient, {
      actor: { sub: ACTOR, roles: [Role.CLINIC_ADMIN] },
      capability: Capability.OPS_SLO_SNAPSHOT_READ,
      resource,
    })).rejects.toBeInstanceOf(DomainException);
    expect(db.query).not.toHaveBeenCalled();
  });
});

describe('CapabilityEvaluatorService telemed.vet.audit-trail.read assignment/category policy', () => {
  const evaluator = new CapabilityEvaluatorService();
  const actor = { sub: ACTOR, roles: [Role.TELEMED_VETERINARIAN] };
  const resource = {
    aggregateType: 'telemed.vet.audit-trail' as const,
    authorityModel: 'platform-assignment' as const,
    assignedEmployeeId: ACTOR,
    dataCategory: 'GENERAL_QUESTION',
  };

  it('allows the assigned veterinarian for a known clinical data category without clinic membership authority', async () => {
    const db = client();
    await expect(evaluator.assertAllowed(db as PoolClient, { actor, capability: Capability.TELEMED_VET_AUDIT_TRAIL_READ, resource })).resolves.toBeUndefined();
    expect(db.query).not.toHaveBeenCalled();
  });

  it.each([
    ['unassigned veterinarian', { ...resource, assignedEmployeeId: OTHER_LOCATION }],
    ['forbidden category', { ...resource, dataCategory: 'VOMITING_DIARRHEA' }],
    ['unknown category', { ...resource, dataCategory: 'UNCLASSIFIED' }],
  ])('normalizes %s denial without membership query', async (_name, deniedResource) => {
    const db = client();
    await expect(evaluator.assertAllowed(db as PoolClient, { actor, capability: Capability.TELEMED_VET_AUDIT_TRAIL_READ, resource: deniedResource })).rejects.toMatchObject({ response: { code: 'CLINIC_SCOPE_MISMATCH' } });
    expect(db.query).not.toHaveBeenCalled();
  });
});
