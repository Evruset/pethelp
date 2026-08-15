import { ApiError } from '@/api/errors';
import { createAuthApi } from './auth-api';

const CHALLENGE = { challengeId: '11111111-1111-4111-8111-111111111111', expiresAt: '2026-08-12T12:05:00.000Z', resendAvailableAt: '2026-08-12T12:01:00.000Z' };
const SESSION = { sessionToken: `vh_${'a'.repeat(64)}`, expiresAt: '2026-08-13T12:00:00.000Z', owner: { id: '22222222-2222-4222-8222-222222222222' } };

it('uses only the canonical client routes and validates public responses', async () => {
  const request = jest.fn().mockResolvedValueOnce(CHALLENGE).mockResolvedValueOnce(CHALLENGE).mockResolvedValueOnce(SESSION);
  const api = createAuthApi({ request });
  await api.requestOtp('+79991234567');
  await api.resendOtp(CHALLENGE.challengeId);
  await expect(api.verifyOtp(CHALLENGE.challengeId, '123456')).resolves.toEqual(SESSION);
  expect(request.mock.calls.map(([path]) => path)).toEqual(['v1/auth/otp/request', 'v1/auth/otp/resend', 'v1/auth/otp/verify']);
});

it('fails closed for malformed challenge and session payloads', async () => {
  const request = jest.fn().mockResolvedValueOnce({ ...CHALLENGE, challengeId: 'unsafe' }).mockResolvedValueOnce({ ...SESSION, sessionToken: 'raw' });
  const api = createAuthApi({ request });
  await expect(api.requestOtp('+79991234567')).rejects.toBeInstanceOf(ApiError);
  await expect(api.verifyOtp(CHALLENGE.challengeId, '123456')).rejects.toBeInstanceOf(ApiError);
});
