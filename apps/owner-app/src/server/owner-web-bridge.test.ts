/** @jest-environment node */
import { ownerWebBridge } from './owner-web-bridge';

const ORIGIN = 'https://owner.vethelp.test';
const TOKEN = `vh_${'a'.repeat(64)}`;
const EXPIRES_AT = '2099-08-13T12:00:00.000Z';
const OWNER_ID = '22222222-2222-4222-8222-222222222222';

function request(path: string, init: RequestInit = {}) {
  return new Request(`${ORIGIN}/api/owner/${path}`, {
    ...init,
    headers: { origin: ORIGIN, host: 'owner.vethelp.test', ...(init.headers ?? {}) },
  });
}

describe('Expo Owner Web session bridge', () => {
  beforeEach(() => {
    process.env.OWNER_WEB_ORIGIN = ORIGIN;
    process.env.VETHELP_API_BASE_URL = 'http://backend.test';
    process.env.OWNER_WEB_BFF_IP_SIGNING_SECRET = 'owner-web-test-signing-secret-32-bytes-long';
  });
  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.OWNER_WEB_ORIGIN;
    delete process.env.VETHELP_API_BASE_URL;
    delete process.env.OWNER_WEB_BFF_IP_SIGNING_SECRET;
  });

  it('keeps the opaque credential HttpOnly and returns only the safe verify projection', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      sessionToken: TOKEN, expiresAt: EXPIRES_AT, owner: { id: OWNER_ID },
    }), { status: 200 }));
    const response = await ownerWebBridge(request('v1/auth/otp/verify', { method: 'POST', body: '{}' }), ['v1', 'auth', 'otp', 'verify']);
    const value = await response.json();
    const cookie = response.headers.get('set-cookie') ?? '';
    expect(value).toEqual({ expiresAt: EXPIRES_AT, owner: { id: OWNER_ID } });
    expect(JSON.stringify(value)).not.toContain(TOKEN);
    expect(cookie).toContain('__Host-vethelp_owner_session=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).not.toContain(TOKEN);
  });

  it('preserves the authoritative expiry during session bootstrap', async () => {
    jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ sessionToken: TOKEN, expiresAt: EXPIRES_AT, owner: { id: OWNER_ID } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ subjectId: OWNER_ID, roles: ['OWNER'] }), { status: 200 }));
    const verified = await ownerWebBridge(request('v1/auth/otp/verify', { method: 'POST', body: '{}' }), ['v1', 'auth', 'otp', 'verify']);
    const cookie = verified.headers.get('set-cookie')?.split(';')[0] ?? '';
    const response = await ownerWebBridge(request('v1/auth/session', { headers: { cookie } }), ['v1', 'auth', 'session']);
    await expect(response.json()).resolves.toEqual({ authenticated: true, subjectId: OWNER_ID, roles: ['OWNER'], expiresAt: EXPIRES_AT });
    expect((global.fetch as jest.Mock).mock.calls[1][1].headers.authorization).toBe(`Bearer ${TOKEN}`);
  });

  it('rejects cross-origin mutations and non-allowlisted routes before backend access', async () => {
    const backend = jest.spyOn(global, 'fetch');
    const crossOrigin = await ownerWebBridge(request('v1/auth/otp/request', { method: 'POST', headers: { origin: 'https://evil.test' }, body: '{}' }), ['v1', 'auth', 'otp', 'request']);
    const unknown = await ownerWebBridge(request('v1/admin/users', { method: 'POST', body: '{}' }), ['v1', 'admin', 'users']);
    expect(crossOrigin.status).toBe(403);
    expect(unknown.status).toBe(404);
    expect(backend).not.toHaveBeenCalled();
  });

  it('treats a missing browser session as a normal guest bootstrap without upstream access', async () => {
    const backend = jest.spyOn(global, 'fetch');
    delete process.env.VETHELP_API_BASE_URL;
    const response = await ownerWebBridge(request('v1/auth/session'), ['v1', 'auth', 'session']);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ code: 'SESSION_EXPIRED' });
    expect(backend).not.toHaveBeenCalled();
  });

  it('keeps production origin and Host matching strict while rejecting local aliases', async () => {
    const backend = jest.spyOn(global, 'fetch');
    const localAlias = await ownerWebBridge(new Request('http://localhost:8081/api/owner/v1/auth/otp/request', { method: 'POST', headers: { origin: 'http://localhost:8081', host: 'localhost:8081' }, body: '{}' }), ['v1', 'auth', 'otp', 'request']);
    const mismatchedHost = await ownerWebBridge(request('v1/auth/otp/request', { method: 'POST', headers: { host: 'forwarded.vethelp.test' }, body: '{}' }), ['v1', 'auth', 'otp', 'request']);
    expect(localAlias.status).toBe(403);
    expect(mismatchedHost.status).toBe(403);
    expect(backend).not.toHaveBeenCalled();
  });

  it('rejects a forged forwarding host and fails closed when IP signing is unavailable', async () => {
    const backend = jest.spyOn(global, 'fetch');
    const forged = await ownerWebBridge(request('v1/auth/otp/request', { method: 'POST', headers: { host: 'evil.test', 'x-forwarded-host': 'owner.vethelp.test' }, body: '{}' }), ['v1', 'auth', 'otp', 'request']);
    delete process.env.OWNER_WEB_BFF_IP_SIGNING_SECRET;
    const unconfigured = await ownerWebBridge(request('v1/auth/otp/request', { method: 'POST', body: '{}' }), ['v1', 'auth', 'otp', 'request']);
    expect(forged.status).toBe(403);
    expect(unconfigured.status).toBe(503);
    expect(backend).not.toHaveBeenCalled();
  });
  it('allowlists the exact owner-scoped Pet Diary GET and preserves bounded pagination', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ petId: OWNER_ID, entries: [], clinicalEntries: [], page: { limit: 100, offset: 0, nextOffset: null, total: 0 } }), { status: 200 }));
    const cookie = Buffer.from(JSON.stringify({ credential: TOKEN, expiresAt: EXPIRES_AT }), 'utf8').toString('base64url');
    const response = await ownerWebBridge(request(`v1/owner/pets/${OWNER_ID}/diary?limit=100&offset=0`, { headers: { cookie: `__Host-vethelp_owner_session=${cookie}` } }), ['v1', 'owner', 'pets', OWNER_ID, 'diary']);
    expect(response.status).toBe(200);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(String(url)).toBe(`http://backend.test/v1/owner/pets/${OWNER_ID}/diary?limit=100&offset=0`);
    expect(init.method).toBe('GET'); expect(init.headers.authorization).toBe(`Bearer ${TOKEN}`);
  });

  it('allowlists the exact Owner Home GET and preserves a selected pet query', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ schemaVersion: 1 }), { status: 200 }));
    const cookie = Buffer.from(JSON.stringify({ credential: TOKEN, expiresAt: EXPIRES_AT }), 'utf8').toString('base64url');
    const response = await ownerWebBridge(request(`v1/owner/home?selectedPetId=${OWNER_ID}`, { headers: { cookie: `__Host-vethelp_owner_session=${cookie}` } }), ['v1', 'owner', 'home']);
    expect(response.status).toBe(200);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(String(url)).toBe(`http://backend.test/v1/owner/home?selectedPetId=${OWNER_ID}`);
    expect(init.method).toBe('GET'); expect(init.headers.authorization).toBe(`Bearer ${TOKEN}`);
  });
});
