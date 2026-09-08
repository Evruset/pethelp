import { EventEmitter } from 'node:events';
import type { NextFunction, Request, Response } from 'express';
import { Role } from '../src/auth/auth.types';
import { ContextLoggerService } from '../src/observability/context-logger.service';
import {
  RegistryReferenceAccessLogMiddleware,
  REGISTRY_REFERENCE_ROUTE,
  sanitizeRegistryReferenceAccessUrl,
} from '../src/observability/registry-reference-access-log.middleware';
import {
  REGISTRY_REFERENCE_ALERTS,
  REGISTRY_REFERENCE_OUTCOMES,
  RegistryReferenceTelemetry,
} from '../src/observability/registry-reference-telemetry';

describe('Registry reference operational privacy and telemetry contract', () => {
  const sentinel = 'operational-fixture-sensitive-value';

  it.each([
    `?administrativeReference=${sentinel}`,
    `?administrativeReference=${encodeURIComponent(`Ю-${sentinel}`)}`,
    `?administrativeReference=${encodeURIComponent(`A/B?${sentinel}`)}`,
    `?administrativeReference=%E0%A4%A${sentinel}`,
    `?administrativeReference=${sentinel}&administrativeReference=duplicate`,
    `?administrativeReference=${sentinel.repeat(20)}`,
  ])('C-01..C-06 redacts exact-reference access URLs without decoding case %#', (query) => {
    const raw = `/v1/clinic/clinic-value/locations/location-value/patients${query}`;
    const sanitized = sanitizeRegistryReferenceAccessUrl(raw);
    expect(sanitized).toBe(`${REGISTRY_REFERENCE_ROUTE}?administrativeReference=[REDACTED]`);
    expect(sanitized).not.toContain(sentinel);
    expect(sanitized).not.toContain('clinic-value');
    expect(sanitized).not.toContain('location-value');
  });

  it('does not classify ordinary Registry or unrelated URLs as reference access events', () => {
    expect(sanitizeRegistryReferenceAccessUrl('/v1/clinic/a/locations/b/patients?q=cat')).toBeNull();
    expect(sanitizeRegistryReferenceAccessUrl('/v1/clinic/a/locations/b/patients')).toBeNull();
    expect(sanitizeRegistryReferenceAccessUrl(`/other?administrativeReference=${sentinel}`)).toBeNull();
  });

  it('persists only the route template and bounded access fields', () => {
    const logger = { event: jest.fn() } as unknown as ContextLoggerService;
    const telemetry = { record: jest.fn() } as unknown as RegistryReferenceTelemetry;
    const middleware = new RegistryReferenceAccessLogMiddleware(logger, telemetry);
    const response = new EventEmitter() as EventEmitter & { statusCode: number };
    response.statusCode = 200;
    const request = {
      method: 'GET',
      originalUrl: `/v1/clinic/clinic-value/locations/location-value/patients?administrativeReference=${sentinel}`,
    } as Request;
    middleware.use(request, response as unknown as Response, jest.fn() as NextFunction);
    response.emit('finish');
    expect(logger.event).toHaveBeenCalledTimes(1);
    const persisted = JSON.stringify((logger.event as jest.Mock).mock.calls);
    expect(persisted).not.toContain(sentinel);
    expect(persisted).not.toContain('clinic-value');
    expect(persisted).not.toContain('location-value');
    expect(persisted).toContain(REGISTRY_REFERENCE_ROUTE);
  });

  it('C-07..C-12 records the exact taxonomy with bounded dimensions only', () => {
    const logger = { event: jest.fn() } as unknown as ContextLoggerService;
    const telemetry = new RegistryReferenceTelemetry(logger);
    for (const outcome of REGISTRY_REFERENCE_OUTCOMES) {
      telemetry.record({
        outcome,
        roles: [Role.CLINIC_RECEPTIONIST],
        featureState: outcome === 'FLAG_DISABLED' ? 'DISABLED' : 'ENABLED',
        resultCount: outcome === 'FOUND' ? 1 : 0,
        queryLength: 12,
        durationMs: 1.25,
      });
    }
    expect(telemetry.snapshot().map((sample) => sample.outcome)).toEqual(REGISTRY_REFERENCE_OUTCOMES);
    expect(telemetry.snapshot().every((sample) =>
      ['RECEPTION', 'ADMIN', 'UNKNOWN'].includes(sample.roleClass)
      && ['EMPTY', 'SHORT', 'MEDIUM', 'LONG', 'OVERSIZED'].includes(sample.queryLengthBucket)
      && (sample.resultCount === 0 || sample.resultCount === 1))).toBe(true);
    const persisted = JSON.stringify((logger.event as jest.Mock).mock.calls);
    for (const forbidden of [
      sentinel, 'actorId', 'clinicId', 'locationId', 'patientId', 'ownerId',
      'sessionId', 'correlationId', 'administrativeReference', 'comparisonKey',
      'fingerprint', 'url', 'ip',
    ]) {
      expect(persisted).not.toContain(forbidden);
    }
    expect(() => telemetry.record({
      outcome: 'FOUND',
      featureState: 'ENABLED',
      resultCount: 2,
      durationMs: 1,
    })).toThrow('result count');
    expect(() => RegistryReferenceTelemetry.assertOperationalPayload({
      outcome: 'EMPTY',
      patientId: 'forbidden',
    })).toThrow('Unsafe');
  });

  it('C-13..C-17 encodes bounded alert thresholds, safe payloads and runbook actions', () => {
    expect(REGISTRY_REFERENCE_ALERTS).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'registry-reference-invariant',
        windowMinutes: 5,
        severity: 'critical',
      }),
      expect.objectContaining({
        id: 'registry-reference-technical-error-ratio',
        windowMinutes: 10,
        minimumRequests: 100,
        threshold: 0.05,
      }),
      expect.objectContaining({
        id: 'registry-reference-policy-unavailable-ratio',
        windowMinutes: 10,
        minimumRequests: 50,
        threshold: 0.01,
      }),
      expect.objectContaining({
        id: 'registry-reference-rate-limit-ratio',
        windowMinutes: 15,
        minimumRequests: 100,
        threshold: 0.10,
      }),
      expect.objectContaining({
        id: 'registry-reference-empty-anomaly',
        windowMinutes: 30,
        minimumRequests: 200,
        threshold: 0.30,
      }),
      expect.objectContaining({ id: 'registry-reference-plan-regression' }),
      expect.objectContaining({ id: 'shared-rate-limit-cleanup-backlog' }),
    ]));
    const emptyAlert = REGISTRY_REFERENCE_ALERTS.find(
      (definition) => definition.id === 'registry-reference-empty-anomaly',
    )!;
    expect(emptyAlert.minimumRequests).toBeGreaterThan(1);
    for (const definition of REGISTRY_REFERENCE_ALERTS) {
      expect(definition.runbookAnchor).not.toBe('');
      expect(definition.payloadFields).toEqual(
        expect.not.arrayContaining([
          'actorId', 'clinicId', 'locationId', 'patientId', 'reference', 'limiterKey',
        ]),
      );
    }
  });
});
