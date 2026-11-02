import { createApiClient } from './client.web';

describe('Owner Web API client allowlist', () => {
  it('allows one encoded catalog q and rejects extra query parameters', async () => {
    const transport = jest.fn().mockResolvedValue(new Response(JSON.stringify({ observedAt: '2026-09-21T06:00:00.000Z', clinics: [] }), { status: 200 }));
    const client = createApiClient(undefined, transport);

    await expect(client.request('v1/owner/clinic-catalog?q=%D0%90%D1%80%D0%B1%D0%B0%D1%82')).resolves.toMatchObject({ clinics: [] });
    expect(transport).toHaveBeenCalledWith('/api/owner/v1/owner/clinic-catalog?q=%D0%90%D1%80%D0%B1%D0%B0%D1%82', expect.objectContaining({ method: 'GET' }));
    await expect(client.request('v1/owner/clinic-catalog?q=clinic&limit=500')).rejects.toMatchObject({ kind: 'UNEXPECTED_RESPONSE' });
  });
});
