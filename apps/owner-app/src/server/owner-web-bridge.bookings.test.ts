/** @jest-environment node */
import { ownerWebBridge } from './owner-web-bridge';

const ORIGIN = 'https://owner.vethelp.test';
const TOKEN = `vh_${'a'.repeat(64)}`;
const EXPIRES_AT = '2099-08-13T12:00:00.000Z';

const cookie = () => {
  const encoded = Buffer.from(JSON.stringify({ credential: TOKEN, expiresAt: EXPIRES_AT }), 'utf8').toString('base64url');
  return `__Host-vethelp_owner_session=${encoded}`;
};

function request(path: string) {
  return new Request(`${ORIGIN}/api/owner/${path}`, {
    headers: { origin: ORIGIN, host: 'owner.vethelp.test', cookie: cookie() },
  });
}

describe('Owner Web My Bookings bridge', () => {
  beforeEach(() => {
    process.env.OWNER_WEB_ORIGIN = ORIGIN;
    process.env.VETHELP_API_BASE_URL = 'http://backend.test';
  });
  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.OWNER_WEB_ORIGIN;
    delete process.env.VETHELP_API_BASE_URL;
  });

  it('allowlists the exact Owner bookings GET and preserves opaque pagination query', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      serverNow: '2026-09-11T10:00:00.000Z', requiresAction: [], active: [], history: [], nextCursor: null,
    }), { status: 200 }));
    const path = 'v1/owner/bookings?limit=20&cursor=eyJyYW5rIjoxfQ';
    const response = await ownerWebBridge(request(path), ['v1', 'owner', 'bookings']);
    expect(response.status).toBe(200);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(String(url)).toBe(`http://backend.test/${path}`);
    expect(init.method).toBe('GET');
    expect(init.headers.authorization).toBe(`Bearer ${TOKEN}`);
  });

  it('does not broaden the route to an unsupported bookings child GET', async () => {
    const backend = jest.spyOn(global, 'fetch');
    const response = await ownerWebBridge(request('v1/owner/bookings/not-a-hold'), ['v1', 'owner', 'bookings', 'not-a-hold']);
    expect(response.status).toBe(404);
    expect(backend).not.toHaveBeenCalled();
  });
});
