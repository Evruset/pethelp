import { createApiClient } from './client.web';

describe('Owner Web bookings allowlist', () => {
  it('allows only the bounded My Bookings list query used by R2J', async () => {
    const transport = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => '{}',
    } as unknown as Response);
    const client = createApiClient(undefined, transport as typeof fetch);

    await client.request('v1/owner/bookings?limit=20');
    await client.request('v1/owner/bookings?limit=20&cursor=eyJyYW5rIjoxfQ');

    expect(transport).toHaveBeenNthCalledWith(
      1,
      '/api/owner/v1/owner/bookings?limit=20',
      expect.objectContaining({ method: 'GET', credentials: 'same-origin' }),
    );
    expect(transport).toHaveBeenNthCalledWith(
      2,
      '/api/owner/v1/owner/bookings?limit=20&cursor=eyJyYW5rIjoxfQ',
      expect.objectContaining({ method: 'GET', credentials: 'same-origin' }),
    );
  });

  it('rejects a broader unplanned bookings query before transport', async () => {
    const transport = jest.fn();
    const client = createApiClient(undefined, transport as typeof fetch);
    await expect(client.request('v1/owner/bookings?limit=50')).rejects.toMatchObject({ kind: 'UNEXPECTED_RESPONSE' });
    expect(transport).not.toHaveBeenCalled();
  });
});
