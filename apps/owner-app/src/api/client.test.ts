import { ApiError } from './errors';
import { createApiClient } from './client';

describe('API client', () => {
  it('serializes JSON and parses a typed successful response', async () => {
    const transport = jest.fn(async () => new Response(JSON.stringify({ id: 'hold-1' }), {
      status: 200,
      headers: { 'x-correlation-id': 'corr-1' },
    }));
    const client = createApiClient('https://api.example.test', transport);

    const result = await client.request<{ id: string }, { slotId: string }>('/v1/holds', {
      method: 'POST',
      body: { slotId: 'slot-1' },
    });

    expect(result).toEqual({ id: 'hold-1' });
    expect(transport).toHaveBeenCalledWith(
      new URL('https://api.example.test/v1/holds'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ slotId: 'slot-1' }) }),
    );
  });

  it.each([
    [401, 'UNAUTHORIZED'], [403, 'FORBIDDEN'], [409, 'CONFLICT'],
    [422, 'VALIDATION'], [503, 'SERVER'],
  ] as const)('normalizes HTTP %s without exposing the raw payload', async (status, kind) => {
    const transport = jest.fn(async () => new Response(JSON.stringify({ secret: 'do-not-expose' }), {
      status,
      headers: { 'x-request-id': 'request-1' },
    }));

    await expect(createApiClient('https://api.example.test', transport).request('/v1/test'))
      .rejects.toMatchObject({ kind, status, correlationId: 'request-1', message: 'The request could not be completed.' });
  });

  it('normalizes malformed success payloads', async () => {
    const transport = jest.fn(async () => new Response('not-json', { status: 200 }));
    await expect(createApiClient('https://api.example.test', transport).request('/v1/test'))
      .rejects.toBeInstanceOf(ApiError);
    await expect(createApiClient('https://api.example.test', transport).request('/v1/test'))
      .rejects.toMatchObject({ kind: 'UNEXPECTED_RESPONSE' });
  });

  it('normalizes an HTTP error even when its body is not JSON', async () => {
    const transport = jest.fn(async () => new Response('<html>unavailable</html>', { status: 503 }));
    await expect(createApiClient('https://api.example.test', transport).request('/v1/test'))
      .rejects.toMatchObject({ kind: 'SERVER', status: 503 });
  });

  it('does not dispatch transport for an already-aborted request', async () => {
    const controller = new AbortController();
    controller.abort();
    const transport = jest.fn();
    await expect(createApiClient('https://api.example.test', transport).request('/v1/test', { signal: controller.signal }))
      .rejects.toMatchObject({ kind: 'NETWORK', message: 'The network request was cancelled.' });
    expect(transport).not.toHaveBeenCalled();
  });

  it('normalizes network failures', async () => {
    const transport = jest.fn(async () => { throw new TypeError('private network detail'); });
    await expect(createApiClient('https://api.example.test', transport).request('/v1/test'))
      .rejects.toMatchObject({ kind: 'NETWORK', message: 'The network request failed.' });
  });

  it('retains only bounded public auth metadata without exposing the raw message', async () => {
    const transport = jest.fn(async () => new Response(JSON.stringify({ code: 'OTP_TEMPORARILY_BLOCKED', message: 'raw provider detail', retryAt: '2026-08-12T12:15:00.000Z', attemptsRemaining: 3 }), { status: 429 }));
    await expect(createApiClient('https://api.example.test', transport).request('/v1/auth/otp/request'))
      .rejects.toMatchObject({ safeCode: 'OTP_TEMPORARILY_BLOCKED', retryAt: '2026-08-12T12:15:00.000Z', attemptsRemaining: 3, message: 'The request could not be completed.' });
  });
});
