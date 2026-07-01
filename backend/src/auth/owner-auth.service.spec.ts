import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../database/database.service';
import { OwnerAuthService } from './owner-auth.service';

describe('OwnerAuthService', () => {
  const originalEnvironment = process.env.NODE_ENV;
  const originalCode = process.env.AUTH_DEV_OTP_CODE;

  afterEach(() => {
    process.env.NODE_ENV = originalEnvironment;
    if (originalCode === undefined) {
      delete process.env.AUTH_DEV_OTP_CODE;
    } else {
      process.env.AUTH_DEV_OTP_CODE = originalCode;
    }
  });

  it('creates a development challenge without exposing any code hash', async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_DEV_OTP_CODE = '123456';
    const client = {
      query: jest.fn(async (statement: string, _parameters?: readonly unknown[]) => {
        if (statement.includes('FROM identity_schema.otp_challenges')) return { rows: [] };
        if (statement.includes('INSERT INTO identity_schema.otp_challenges')) {
          return {
            rows: [{
              challengeId: '11111111-1111-4111-8111-111111111111',
              expiresAt: new Date('2026-06-25T12:05:00.000Z'),
              resendAvailableAt: new Date('2026-06-25T12:01:00.000Z'),
            }],
          };
        }
        return { rows: [] };
      }),
    };
    const database = {
      withTransaction: async <T>(work: (transaction: typeof client) => Promise<T>) => work(client),
    } as unknown as DatabaseService;
    const service = new OwnerAuthService(database, {} as JwtService);

    const result = await service.requestOtp({ phone: '+79991234567' });

    expect(result).toEqual({
      challengeId: '11111111-1111-4111-8111-111111111111',
      expiresAt: '2026-06-25T12:05:00.000Z',
      resendAvailableAt: '2026-06-25T12:01:00.000Z',
      developmentCode: '123456',
    });
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO identity_schema.otp_challenges'), expect.arrayContaining(['+79991234567']));
    const queryParameters = client.query.mock.calls.flatMap(([, parameters]) => (Array.isArray(parameters) ? parameters : []));
    expect(queryParameters).not.toContain('123456');
  });

  it('rejects a non-E.164 phone before touching the database', async () => {
    const database = { withTransaction: jest.fn() } as unknown as DatabaseService;
    const service = new OwnerAuthService(database, {} as JwtService);

    await expect(service.requestOtp({ phone: '8 999 123 45 67' })).rejects.toBeInstanceOf(BadRequestException);
    expect(database.withTransaction).not.toHaveBeenCalled();
  });
  it('writes an OTP authentication audit row after successful verification', async () => {
    const phone = '+79991234567';
    const challengeId = '11111111-1111-4111-8111-111111111111';
    const ownerId = '22222222-2222-4222-8222-222222222222';
    const code = '123456';
    let codeHash = '';

    const client = {
      query: jest.fn(async (statement: string, _parameters?: readonly unknown[]) => {
        if (statement.includes('FROM identity_schema.otp_challenges')) {
          return {
            rows: [{
              id: challengeId,
              phone_e164: phone,
              code_hash: codeHash,
              expires_at: new Date('2099-01-01T00:00:00.000Z'),
              attempts_remaining: 3,
              consumed_at: null,
            }],
          };
        }
        if (statement.includes('FROM identity_schema.owner_identities')) {
          return { rows: [{ user_id: ownerId, phone_e164: phone }] };
        }
        return { rows: [] };
      }),
    };

    const database = {
      withTransaction: async <T>(work: (transaction: typeof client) => Promise<T>) => work(client),
    } as unknown as DatabaseService;
    const jwt = {
      signAsync: jest.fn().mockResolvedValue('access-token'),
    } as unknown as JwtService;
    const service = new OwnerAuthService(database, jwt);

    codeHash = (service as unknown as {
      otpHash: (id: string, normalizedPhone: string, value: string) => string;
    }).otpHash(challengeId, phone, code);

    const result = await service.verifyOtp({
      phone,
      challengeId,
      code,
      deviceName: ' iPhone  ',
    });

    expect(result.accessToken).toBe('access-token');
    expect(result.owner).toEqual({ id: ownerId, phone });

    const sessionCall = client.query.mock.calls.find(([statement]) =>
      typeof statement === 'string' && statement.includes('INSERT INTO identity_schema.owner_sessions'),
    );
    const auditCall = client.query.mock.calls.find(([statement]) =>
      typeof statement === 'string' && statement.includes('INSERT INTO audit_schema.audit_log'),
    );

    if (!sessionCall || !auditCall || !sessionCall[1] || !auditCall[1]) {
      throw new Error('Expected session and audit inserts with parameters');
    }

    const sessionParameters = sessionCall[1];
    const auditSql = auditCall[0];
    const auditParameters = auditCall[1];
    const auditPayload = JSON.parse(auditParameters[2] as string);

    expect(auditSql).toContain('$1::text');
    expect(auditSql).toContain('$1::uuid');
    expect(auditParameters[0]).toBe(ownerId);
    expect(auditParameters[1]).toBe('user.authenticated');
    expect(auditPayload).toEqual({
      method: 'otp',
      sessionId: sessionParameters[0],
      challengeId,
      deviceName: 'iPhone',
    });
  });

  it('writes a refresh authentication audit row with the rotated session id', async () => {
    const ownerId = '22222222-2222-4222-8222-222222222222';
    const oldSessionId = '33333333-3333-4333-8333-333333333333';
    const refreshToken = 'r'.repeat(48);

    const client = {
      query: jest.fn(async (statement: string, _parameters?: readonly unknown[]) => {
        if (statement.includes('FROM identity_schema.owner_sessions session')) {
          return {
            rows: [{
              id: oldSessionId,
              user_id: ownerId,
              phone_e164: '+79991234567',
            }],
          };
        }
        return { rows: [] };
      }),
    };

    const database = {
      withTransaction: async <T>(work: (transaction: typeof client) => Promise<T>) => work(client),
    } as unknown as DatabaseService;
    const jwt = {
      signAsync: jest.fn().mockResolvedValue('access-token'),
    } as unknown as JwtService;
    const service = new OwnerAuthService(database, jwt);

    const result = await service.refresh({
      refreshToken,
      deviceName: ' Safari ',
    });

    expect(result.accessToken).toBe('access-token');
    expect(result.owner).toEqual({ id: ownerId, phone: '+79991234567' });

    const sessionCall = client.query.mock.calls.find(([statement]) =>
      typeof statement === 'string' && statement.includes('INSERT INTO identity_schema.owner_sessions'),
    );
    const auditCall = client.query.mock.calls.find(([statement]) =>
      typeof statement === 'string' && statement.includes('INSERT INTO audit_schema.audit_log'),
    );

    if (!sessionCall || !auditCall || !sessionCall[1] || !auditCall[1]) {
      throw new Error('Expected session and audit inserts with parameters');
    }

    const sessionParameters = sessionCall[1];
    const auditSql = auditCall[0];
    const auditParameters = auditCall[1];
    const auditPayload = JSON.parse(auditParameters[2] as string);

    expect(auditSql).toContain('$1::text');
    expect(auditSql).toContain('$1::uuid');
    expect(auditParameters[0]).toBe(ownerId);
    expect(auditParameters[1]).toBe('user.authenticated');
    expect(auditPayload).toEqual({
      method: 'refresh',
      sessionId: sessionParameters[0],
      rotatedFromSessionId: oldSessionId,
      deviceName: 'Safari',
    });
  });

});
