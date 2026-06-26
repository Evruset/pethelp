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
});
