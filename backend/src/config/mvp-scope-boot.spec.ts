process.env.JWT_SECRET = 'mvp-scope-boot-test-secret-at-least-32-bytes';
process.env.JWT_ISSUER = 'mvp-scope-boot-test';
process.env.JWT_AUDIENCE = 'mvp-scope-boot-test';
process.env.WORKER_SERVICE_TOKEN = 'mvp-scope-worker-token';
process.env.MVP_SCOPE_PROFILE = 'PILOT_V1';
process.env.WORKERS_ENABLED = 'false';
delete process.env.MIS_VET_MANAGER_BASE_URL;
delete process.env.MIS_VET_MANAGER_API_KEY;
delete process.env.ACQUIRING_API_BASE_URL;
delete process.env.ACQUIRING_API_KEY;
delete process.env.LIVEKIT_API_URL;
delete process.env.LIVEKIT_API_KEY;
delete process.env.LIVEKIT_API_SECRET;

import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';

const { DatabaseService } = require('../database/database.service') as typeof import('../database/database.service');
const { NestRoot } = require('../nest-root-full') as typeof import('../nest-root-full');

describe('PILOT_V1 boot containment', () => {
  let app: INestApplication;

  beforeAll(async () => {
    jest.spyOn(DatabaseService.prototype, 'query').mockResolvedValue({
      rows: [{ now: new Date('2026-08-08T07:00:00.000Z') }],
      rowCount: 1,
      command: 'SELECT',
      oid: 0,
      fields: [],
    });
    app = await NestFactory.create(NestRoot, { logger: false });
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('boots without external credentials and keeps database-backed health green', async () => {
    const response = await request(app.getHttpServer()).get('/v1/health').expect(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      profile: 'PILOT_V1',
      optionalCapabilities: {
        mis: 'DISABLED',
        onlinePayments: 'DISABLED',
        telemedicine: 'DISABLED',
        insurance: 'DISABLED',
        emergency: 'DISABLED',
      },
    });
  });

  it.each([
    ['POST', '/v1/booking-holds/00000000-0000-4000-8000-000000000000/payment-intents'],
    ['GET', '/v1/insurance/profiles'],
    ['GET', '/v1/telemed/sessions'],
    ['GET', '/v1/emergency/clinics'],
  ])('does not register the optional %s %s route', async (method, path) => {
    await request(app.getHttpServer())[method.toLowerCase() as 'get' | 'post'](path).expect(404);
  });
});
