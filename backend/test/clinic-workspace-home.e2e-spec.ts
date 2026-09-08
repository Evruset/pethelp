import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { Role } from '../src/auth/auth.types';
import { BookingErrorFilter } from '../src/common/booking-error.filter';
import { config } from '../src/config';
import { DatabaseService } from '../src/database/database.service';
import { NestRoot } from '../src/nest-root-full';
import { resetWorkspaceFixtures, WORKSPACE_IDS as IDS } from './clinic-workspace-home.fixtures';

jest.setTimeout(90_000);
type Actor = { sub: string; roles: Role[]; clinicIds?: string[]; locationIds?: string[] };

describe('Clinic Workspace Home HTTP authority', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let jwt: JwtService;
  beforeAll(async () => {
    process.env.WORKERS_ENABLED = 'false';
    app = await NestFactory.create(NestRoot, { logger: false });
    app.useGlobalFilters(new BookingErrorFilter());
    await app.init();
    database = app.get(DatabaseService);
    jwt = app.get(JwtService);
  });
  beforeEach(async () => resetWorkspaceFixtures(database));
  afterAll(async () => app?.close());

  const tokenFor = (actor: Actor) => jwt.signAsync(actor, { secret: config.jwtSecret, issuer: config.jwtIssuer, audience: config.jwtAudience, algorithm: 'HS256' });
  const get = async (actor: Actor | null, expectedStatus: number, clinicId: string = IDS.clinic, locationId: string = IDS.location) => {
    const call = request(app.getHttpServer()).get(`/v1/clinic/${clinicId}/locations/${locationId}/workspace-home`);
    if (actor) call.set('Authorization', `Bearer ${await tokenFor(actor)}`);
    return call.expect(expectedStatus);
  };
  const actor = (sub: string, roles: Role[]): Actor => ({ sub, roles, clinicIds: [IDS.clinic], locationIds: [IDS.location] });

  it.each([
    ['receptionist', actor(IDS.receptionist, [Role.CLINIC_RECEPTIONIST]), ['AVAILABLE','NOT_CONFIGURED','AVAILABLE','NOT_AUTHORIZED','NOT_CONFIGURED']],
    ['admin', actor(IDS.admin, [Role.CLINIC_ADMIN]), ['AVAILABLE','NOT_CONFIGURED','AVAILABLE','NOT_AUTHORIZED','NOT_CONFIGURED']],
    ['veterinarian', actor(IDS.veterinarian, [Role.CLINIC_VETERINARIAN]), ['NOT_AUTHORIZED','NOT_AUTHORIZED','NOT_AUTHORIZED','NOT_CONFIGURED','NOT_AUTHORIZED']],
    ['multi-role', actor(IDS.receptionist, [Role.CLINIC_RECEPTIONIST, Role.CLINIC_VETERINARIAN]), ['AVAILABLE','NOT_CONFIGURED','AVAILABLE','NOT_CONFIGURED','NOT_CONFIGURED']],
  ] as const)('returns the fixed capability-filtered tuple for %s', async (_name, principal, availability) => {
    const response = await get(principal, 200);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.headers.etag).toBeUndefined();
    expect(response.body.sections.map((section: { kind: string }) => section.kind)).toEqual(['QUEUE','SCHEDULE','APPOINTMENTS','VETERINARIAN','QUALITY']);
    expect(response.body.sections.map((section: { availability: string }) => section.availability)).toEqual(availability);
    for (const section of response.body.sections.filter((value: { availability: string }) => value.availability !== 'AVAILABLE')) {
      expect(section).not.toHaveProperty('facts');
      expect(section).not.toHaveProperty('action');
    }
    expect(Buffer.byteLength(JSON.stringify(response.body))).toBeLessThanOrEqual(8192);
    expectForbiddenKeys(response.body);
  });

  it.each([
    ['revoked', actor(IDS.revoked, [Role.CLINIC_RECEPTIONIST]), IDS.clinic, IDS.location],
    ['inactive', actor(IDS.inactive, [Role.CLINIC_RECEPTIONIST]), IDS.clinic, IDS.location],
    ['claims without membership', actor(IDS.noMembership, [Role.CLINIC_RECEPTIONIST]), IDS.clinic, IDS.location],
    ['missing clinic claim', { sub: IDS.receptionist, roles: [Role.CLINIC_RECEPTIONIST], locationIds: [IDS.location] }, IDS.clinic, IDS.location],
    ['missing location claim', { sub: IDS.receptionist, roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [IDS.clinic] }, IDS.clinic, IDS.location],
    ['cross clinic route', actor(IDS.receptionist, [Role.CLINIC_RECEPTIONIST]), IDS.otherClinic, IDS.location],
    ['cross location route', actor(IDS.receptionist, [Role.CLINIC_RECEPTIONIST]), IDS.clinic, IDS.otherLocation],
    ['mismatched clinic/location', { sub: IDS.receptionist, roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [IDS.otherClinic], locationIds: [IDS.otherClinicLocation] }, IDS.otherClinic, IDS.location],
    ['non-clinic actor', { sub: IDS.owner, roles: [Role.OWNER], clinicIds: [IDS.clinic], locationIds: [IDS.location] }, IDS.clinic, IDS.location],
  ] as const)('normalizes %s to a no-leak 403', async (_name, principal, clinicId, locationId) => {
    const response = await get(principal as Actor, 403, clinicId, locationId);
    expect(response.body).toMatchObject({ statusCode: 403, code: 'CLINIC_SCOPE_MISMATCH' });
    expect(JSON.stringify(response.body)).not.toMatch(/membership|capability|locationId|clinicId|sections/i);
  });

  it.each([['bad', IDS.location], [IDS.clinic, 'bad']])('rejects malformed UUIDs before tenant authority', async (clinicId, locationId) => {
    const response = await get(actor(IDS.receptionist, [Role.CLINIC_RECEPTIONIST]), 400, clinicId, locationId);
    expect(response.body).toMatchObject({ code: 'INVALID_REQUEST' });
  });

  it('requires authentication before service authority', async () => {
    await get(null, 401);
  });
});

function expectForbiddenKeys(value: unknown, topLevel = true): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) return value.forEach((item) => expectForbiddenKeys(item, false));
  for (const [key, nested] of Object.entries(value)) {
    const normalized = key.toLowerCase();
    if (!(topLevel && (normalized === 'clinicid' || normalized === 'locationid'))) {
      expect(['ownerid','patientid','petid','holdid','appointmentid','doctorid','employeeid','actorid','documentid','audit','payment','clinical']).not.toContain(normalized);
    }
    expectForbiddenKeys(nested, false);
  }
}
