import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';
import { BookingErrorFilter } from '../src/common/booking-error.filter';
import { DatabaseService } from '../src/database/database.service';
import { NestRoot } from '../src/nest-root-full';
import { DeterministicOtpDeliveryStub } from '../src/auth/deterministic-otp-delivery.stub';

jest.setTimeout(60_000);

describe('T018 Owner auth HTTP contract', () => {
  let app: INestApplication;
  let database: DatabaseService;
  const phone = '+79990000009';
  const proxyPhones = Array.from({ length: 21 }, (_, index) => `+79988${String(index).padStart(6, '0')}`);

  beforeAll(async () => {
    process.env.WORKERS_ENABLED = 'false';
    process.env.AUTH_DEV_OTP_CODE = '246810';
    process.env.AUTH_OTP_STUB_OUTCOME = 'ACCEPTED';
    app = await NestFactory.create(NestRoot, { logger: false });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new BookingErrorFilter());
    await app.init();
    database = app.get(DatabaseService);
  });

  beforeEach(async () => {
    const owner = await database.query<{ user_id: string }>(`SELECT user_id::text FROM identity_schema.owner_identities WHERE phone_e164=$1`, [phone]);
    if (owner.rows[0]) await database.query(`DELETE FROM identity_schema.owner_sessions WHERE user_id=$1::uuid`, [owner.rows[0].user_id]);
    await database.query(`DELETE FROM identity_schema.otp_challenges WHERE phone_e164=$1`, [phone]);
    await database.query(`DELETE FROM identity_schema.otp_challenges WHERE phone_e164=ANY($1::text[])`, [proxyPhones]);
    await database.query(`TRUNCATE identity_schema.otp_rate_limit_attempts, identity_schema.otp_rate_limit_blocks`);
  });

  afterAll(async () => app?.close());

  it('creates and verifies a challenge, reads effective session and revokes it idempotently', async () => {
    const challenge = await request(app.getHttpServer())
      .post('/v1/auth/otp/request')
      .send({ phone })
      .expect(200);
    expect(challenge.body).toEqual({
      challengeId: expect.any(String),
      expiresAt: expect.stringMatching(/Z$/),
      resendAvailableAt: expect.stringMatching(/Z$/),
    });
    expect(JSON.stringify(challenge.body)).not.toContain('246810');

    const verified = await request(app.getHttpServer())
      .post('/v1/auth/otp/verify')
      .send({ challengeId: challenge.body.challengeId, code: '246810', deviceName: 'Test device' })
      .expect(200);
    expect(verified.body).toMatchObject({
      sessionToken: expect.stringMatching(/^vh_[A-Za-z0-9_-]{64}$/),
      expiresAt: expect.stringMatching(/Z$/),
      owner: { id: expect.any(String) },
    });
    expect(verified.body).not.toHaveProperty('accessToken');
    expect(verified.body).not.toHaveProperty('refreshToken');

    await request(app.getHttpServer())
      .get('/v1/auth/session')
      .set('Authorization', `Bearer ${verified.body.sessionToken}`)
      .expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ subjectId: verified.body.owner.id, roles: ['OWNER'] }));

    await request(app.getHttpServer()).post('/v1/auth/logout').set('Authorization', `Bearer ${verified.body.sessionToken}`).expect(204);
    await request(app.getHttpServer()).post('/v1/auth/logout').set('Authorization', `Bearer ${verified.body.sessionToken}`).expect(204);
    await request(app.getHttpServer()).get('/v1/auth/session').set('Authorization', `Bearer ${verified.body.sessionToken}`).expect(401);
  });

  it('returns stable safe errors without raw provider details or session success', async () => {
    process.env.AUTH_OTP_STUB_OUTCOME = 'OUTCOME_UNKNOWN';
    const failed = await request(app.getHttpServer()).post('/v1/auth/otp/request').send({ phone }).expect(503);
    expect(failed.body).toMatchObject({ code: 'OTP_PROVIDER_OUTCOME_UNKNOWN' });
    expect(failed.body).not.toHaveProperty('sessionToken');
    expect(JSON.stringify(failed.body)).not.toContain(phone);
    process.env.AUTH_OTP_STUB_OUTCOME = 'ACCEPTED';
  });

  it('blocks the sixth external request before challenge/provider side effects', async () => {
    const provider = app.get(DeterministicOtpDeliveryStub);
    const send = jest.spyOn(provider, 'sendOtp');
    await request(app.getHttpServer()).post('/v1/auth/otp/request').send({ phone }).expect(200);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await request(app.getHttpServer()).post('/v1/auth/otp/request').send({ phone }).expect(429);
    }
    const blocked = await request(app.getHttpServer()).post('/v1/auth/otp/request').send({ phone }).expect(429);
    expect(blocked.body).toMatchObject({ code: 'OTP_RATE_LIMITED', retryAt: expect.stringMatching(/Z$/) });
    expect(JSON.stringify(blocked.body)).not.toContain(phone);
    expect(send).toHaveBeenCalledTimes(1);
    const challenges = await database.query<{ count: number }>('SELECT COUNT(*)::int count FROM identity_schema.otp_challenges WHERE phone_e164=$1', [phone]);
    expect(challenges.rows[0].count).toBe(1);
    const active = await request(app.getHttpServer()).post('/v1/auth/otp/request').send({ phone }).expect(429);
    expect(active.body).toMatchObject({ code: 'OTP_TEMPORARILY_BLOCKED', retryAt: expect.any(String) });
    expect(send).toHaveBeenCalledTimes(1);
    send.mockRestore();
  });

  it('ignores spoofed forwarding headers and enforces the direct-peer IP limit', async () => {
    const provider = app.get(DeterministicOtpDeliveryStub);
    const send = jest.spyOn(provider, 'sendOtp');
    for (let index = 0; index < 20; index += 1) {
      await request(app.getHttpServer()).post('/v1/auth/otp/request')
        .set('X-Forwarded-For', `198.51.100.${index + 1}`).send({ phone: proxyPhones[index] }).expect(200);
    }
    const blocked = await request(app.getHttpServer()).post('/v1/auth/otp/request')
      .set('X-Forwarded-For', '198.51.100.250').send({ phone: proxyPhones[20] }).expect(429);
    expect(blocked.body).toMatchObject({ code: 'OTP_RATE_LIMITED', retryAt: expect.any(String) });
    expect(send).toHaveBeenCalledTimes(20);
    send.mockRestore();
  });

  it('keeps rate-limit response contract enumeration-neutral for known and unknown phones', async () => {
    const unknownPhone='+79990009999';
    for(const candidate of [phone,unknownPhone]) {
      for(let attempt=0;attempt<5;attempt+=1) await request(app.getHttpServer()).post('/v1/auth/otp/request').send({phone:candidate}).expect(attempt===0?200:429);
    }
    const known=await request(app.getHttpServer()).post('/v1/auth/otp/request').send({phone}).expect(429);
    const unknown=await request(app.getHttpServer()).post('/v1/auth/otp/request').send({phone:unknownPhone}).expect(429);
    expect(known.body).toMatchObject({code:'OTP_RATE_LIMITED',message:expect.any(String),retryAt:expect.any(String)});
    expect(unknown.body).toMatchObject({code:known.body.code,message:known.body.message,retryAt:expect.any(String)});
    expect(Object.keys(unknown.body).sort()).toEqual(Object.keys(known.body).sort());
    expect(JSON.stringify([known.body,unknown.body])).not.toContain(phone);
    expect(JSON.stringify([known.body,unknown.body])).not.toContain(unknownPhone);
  });
});
