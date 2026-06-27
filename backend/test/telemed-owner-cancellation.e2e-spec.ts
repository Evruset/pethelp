import 'reflect-metadata';
import { Module, ValidationPipe, type INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';
import { BookingErrorFilter } from '../src/common/booking-error.filter';
import { TraceContext } from '../src/observability/trace-context.context';

process.env.JWT_SECRET ??= 'telemed-owner-cancel-e2e-secret-at-least-32-bytes';
process.env.JWT_ISSUER ??= 'vethelp-test';
process.env.JWT_AUDIENCE ??= 'vethelp-test';
process.env.WORKER_SERVICE_TOKEN ??= 'telemed-owner-cancel-worker-token';

const {
  TelemedOwnerSessionController,
} = require('../src/modules/telemed/telemed-owner-session.controller') as typeof import('../src/modules/telemed/telemed-owner-session.controller');
const { TelemedOwnerSessionService } = require('../src/modules/telemed/telemed-owner-session.service') as typeof import('../src/modules/telemed/telemed-owner-session.service');
const { TelemedIntakeService } = require('../src/modules/telemed/telemed-intake.service') as typeof import('../src/modules/telemed/telemed-intake.service');
const { TelemedPaymentService } = require('../src/modules/telemed/telemed-payment.service') as typeof import('../src/modules/telemed/telemed-payment.service');
const {
  TelemedOwnerCancellationService,
} = require('../src/modules/telemed/telemed-owner-cancellation.service') as typeof import('../src/modules/telemed/telemed-owner-cancellation.service');
const { JwtAuthGuard } = require('../src/auth/jwt-auth.guard') as typeof import('../src/auth/jwt-auth.guard');
const { RolesGuard } = require('../src/auth/roles.guard') as typeof import('../src/auth/roles.guard');
const { Role } = require('../src/auth/auth.types') as typeof import('../src/auth/auth.types');
const { config } = require('../src/config') as typeof import('../src/config');

const IDS = {
  owner: '11111111-1111-4111-8111-111111111111',
  receptionist: '22222222-2222-4222-8222-222222222222',
  session: '33333333-3333-4333-8333-333333333333',
  idempotency: '44444444-4444-4444-8444-444444444444',
};

const cancellationMock = {
  cancel: jest.fn(),
};

@Module({
  controllers: [TelemedOwnerSessionController],
  providers: [
    JwtService,
    TraceContext,
    JwtAuthGuard,
    RolesGuard,
    { provide: TelemedOwnerSessionService, useValue: {} },
    { provide: TelemedIntakeService, useValue: {} },
    { provide: TelemedPaymentService, useValue: {} },
    { provide: TelemedOwnerCancellationService, useValue: cancellationMock },
  ],
})
class TelemedOwnerCancellationE2eModule {}

describe('Telemed owner cancellation HTTP endpoint', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let ownerToken: string;
  let receptionistToken: string;

  beforeAll(async () => {
    app = await NestFactory.create(TelemedOwnerCancellationE2eModule, { logger: false });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new BookingErrorFilter());
    await app.init();

    jwt = app.get(JwtService);
    ownerToken = await signToken(jwt, IDS.owner, [Role.OWNER]);
    receptionistToken = await signToken(jwt, IDS.receptionist, [Role.CLINIC_RECEPTIONIST]);
  });

  beforeEach(() => {
    cancellationMock.cancel.mockReset();
    cancellationMock.cancel.mockResolvedValue({
      sessionId: IDS.session,
      state: 'CANCELLED',
      telemedCaseState: 'CANCELLED_BY_OWNER',
      paymentStatus: 'VOID_REQUESTED',
      refundState: 'VOID_REQUESTED',
      version: 2,
      serverNow: '2026-06-26T12:00:00.000Z',
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('requires a valid owner JWT', async () => {
    const response = await request(app.getHttpServer())
      .post(`/v1/telemed/sessions/${IDS.session}/cancel`)
      .set('Idempotency-Key', IDS.idempotency)
      .send({})
      .expect(401);

    expect(response.body).toMatchObject({ code: 'MISSING_BEARER_TOKEN' });
    expect(cancellationMock.cancel).not.toHaveBeenCalled();
  });

  it('rejects non-owner roles before calling the cancellation service', async () => {
    const response = await request(app.getHttpServer())
      .post(`/v1/telemed/sessions/${IDS.session}/cancel`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .set('Idempotency-Key', IDS.idempotency)
      .send({})
      .expect(403);

    expect(response.body).toMatchObject({ code: 'ROLE_FORBIDDEN' });
    expect(cancellationMock.cancel).not.toHaveBeenCalled();
  });

  it('validates sessionId as UUID', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/telemed/sessions/not-a-uuid/cancel')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', IDS.idempotency)
      .send({})
      .expect(400);

    expect(response.body).toMatchObject({ code: 'INVALID_REQUEST' });
    expect(cancellationMock.cancel).not.toHaveBeenCalled();
  });

  it('requires an Idempotency-Key UUID header', async () => {
    const response = await request(app.getHttpServer())
      .post(`/v1/telemed/sessions/${IDS.session}/cancel`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({})
      .expect(400);

    expect(response.body).toMatchObject({ code: 'INVALID_IDEMPOTENCY_KEY' });
    expect(cancellationMock.cancel).not.toHaveBeenCalled();
  });

  it('passes session owner and idempotency key into the cancellation command', async () => {
    const response = await request(app.getHttpServer())
      .post(`/v1/telemed/sessions/${IDS.session}/cancel`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', IDS.idempotency)
      .send({})
      .expect(200);

    expect(response.body).toMatchObject({
      sessionId: IDS.session,
      state: 'CANCELLED',
      telemedCaseState: 'CANCELLED_BY_OWNER',
      paymentStatus: 'VOID_REQUESTED',
      refundState: 'VOID_REQUESTED',
    });
    expect(cancellationMock.cancel).toHaveBeenCalledTimes(1);
    expect(cancellationMock.cancel).toHaveBeenCalledWith({
      sessionId: IDS.session,
      ownerId: IDS.owner,
      idempotencyKey: IDS.idempotency,
    });
  });
});

async function signToken(jwt: JwtService, sub: string, roles: string[]): Promise<string> {
  return jwt.signAsync(
    { sub, roles },
    {
      secret: config.jwtSecret,
      issuer: config.jwtIssuer,
      audience: config.jwtAudience,
      algorithm: 'HS256',
    },
  );
}
