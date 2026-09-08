import { apiClient, type ApiClient } from '@/api/client';
import { ApiError } from '@/api/errors';

export type OtpChallenge = Readonly<{ challengeId: string; expiresAt: string; resendAvailableAt: string }>;
export type OwnerSessionResult = Readonly<{ sessionToken: string; expiresAt: string; owner: Readonly<{ id: string }> }>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN = /^vh_[A-Za-z0-9_-]{64}$/;
const validDate = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));

function challenge(value: unknown): OtpChallenge {
  if (typeof value !== 'object' || value === null) throw invalidResponse();
  const item = value as Record<string, unknown>;
  if (typeof item.challengeId !== 'string' || !UUID.test(item.challengeId) || !validDate(item.expiresAt) || !validDate(item.resendAvailableAt)) throw invalidResponse();
  return { challengeId: item.challengeId, expiresAt: item.expiresAt, resendAvailableAt: item.resendAvailableAt };
}

function session(value: unknown): OwnerSessionResult {
  if (typeof value !== 'object' || value === null) throw invalidResponse();
  const item = value as Record<string, unknown>;
  const owner = item.owner as Record<string, unknown> | undefined;
  if (typeof item.sessionToken !== 'string' || !TOKEN.test(item.sessionToken) || !validDate(item.expiresAt) || !owner || typeof owner.id !== 'string' || !UUID.test(owner.id)) throw invalidResponse();
  return { sessionToken: item.sessionToken, expiresAt: item.expiresAt, owner: { id: owner.id } };
}

function invalidResponse() {
  return new ApiError('UNEXPECTED_RESPONSE', 'The server returned an invalid response.');
}

export type AuthApi = Readonly<{
  requestOtp(phone: string, signal?: AbortSignal): Promise<OtpChallenge>;
  resendOtp(challengeId: string, signal?: AbortSignal): Promise<OtpChallenge>;
  verifyOtp(challengeId: string, code: string, signal?: AbortSignal): Promise<OwnerSessionResult>;
}>;

export function createAuthApi(client: ApiClient = apiClient): AuthApi {
  return {
    async requestOtp(phone, signal) { return challenge(await client.request<unknown, { phone: string }>('v1/auth/otp/request', { method: 'POST', body: { phone }, signal })); },
    async resendOtp(challengeId, signal) { return challenge(await client.request<unknown, { challengeId: string }>('v1/auth/otp/resend', { method: 'POST', body: { challengeId }, signal })); },
    async verifyOtp(challengeId, code, signal) { return session(await client.request<unknown, { challengeId: string; code: string }>('v1/auth/otp/verify', { method: 'POST', body: { challengeId, code }, signal })); },
  };
}

export const authApi = createAuthApi();
