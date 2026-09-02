import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';

const COOKIE = '__Host-vethelp_owner_session';
const MAX_RESPONSE_BYTES = 1_048_576;
const UUID = '[0-9a-fA-F-]{36}';
const SESSION_TOKEN = /^vh_[A-Za-z0-9_-]{64}$/;

const ROUTES = [
  { pattern: /^v1\/auth\/otp\/(request|resend|verify)$/, methods: ['POST'], public: true },
  { pattern: /^v1\/auth\/session$/, methods: ['GET'] },
  { pattern: /^v1\/auth\/logout$/, methods: ['POST'] },
  { pattern: /^v1\/owner\/pets$/, methods: ['GET', 'POST'] },
  { pattern: new RegExp(`^v1/owner/pets/${UUID}/diary$`), methods: ['GET'] },
  { pattern: /^v1\/owner\/clinic-catalog$/, methods: ['GET'] },
  { pattern: new RegExp(`^v1/owner/clinic-catalog/${UUID}/locations/${UUID}$`), methods: ['GET'] },
  { pattern: new RegExp(`^v1/owner/clinic-catalog/${UUID}/locations/${UUID}/services/${UUID}/availability$`), methods: ['GET'] },
  { pattern: /^v1\/booking-holds$/, methods: ['POST'] },
  { pattern: new RegExp(`^v1/booking-holds/${UUID}$`), methods: ['GET'] },
  { pattern: new RegExp(`^v1/owner/bookings/${UUID}/cancel$`), methods: ['POST'] },
] as const;

type CookieSession = Readonly<{ credential: string; expiresAt: string }>;

function json(body: unknown, status = 200, headers: HeadersInit = {}) {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store', ...headers } });
}

function readSession(request: Request): CookieSession | null {
  const rawCookie = request.headers.get('cookie') ?? '';
  const encoded = rawCookie.split(';').map((part) => part.trim().split('=')).find(([name]) => name === COOKIE)?.slice(1).join('=');
  if (!encoded) return null;
  try {
    const value = JSON.parse(Buffer.from(decodeURIComponent(encoded), 'base64url').toString('utf8')) as Partial<CookieSession>;
    const expiry = Date.parse(String(value.expiresAt));
    if (!SESSION_TOKEN.test(String(value.credential)) || !Number.isFinite(expiry) || expiry <= Date.now()) return null;
    return { credential: String(value.credential), expiresAt: new Date(expiry).toISOString() };
  } catch {
    return null;
  }
}

function clearCookie() {
  return `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

function sessionCookie(session: CookieSession) {
  const encoded = Buffer.from(JSON.stringify(session), 'utf8').toString('base64url');
  return `${COOKIE}=${encoded}; HttpOnly; Secure; SameSite=Lax; Path=/; Expires=${new Date(session.expiresAt).toUTCString()}`;
}

function mutationAllowed(request: Request) {
  const configured = process.env.OWNER_WEB_ORIGIN;
  if (!configured) return false;
  const expected = new URL(configured);
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  return origin === expected.origin && host?.toLowerCase() === expected.host.toLowerCase();
}

function signedClientIp(request: Request) {
  const secret = process.env.OWNER_WEB_BFF_IP_SIGNING_SECRET;
  if (!secret || secret.length < 32) throw new Error('IP_SIGNING_NOT_CONFIGURED');
  const rawIp = process.env.OWNER_WEB_TRUSTED_PLATFORM === 'EAS_HOSTING' ? request.headers.get('x-real-ip') ?? '' : '127.0.0.1';
  const ip = rawIp.trim().toLowerCase();
  if (!isIP(ip)) throw new Error('TRUSTED_CLIENT_IP_INVALID');
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', secret).update(`${timestamp}\n${ip}`).digest('hex');
  return {
    'X-VetHelp-Client-IP': ip,
    'X-VetHelp-Client-IP-Timestamp': timestamp,
    'X-VetHelp-Client-IP-Signature': signature,
  };
}

function safeError(status: number, value: unknown) {
  const item = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    code: typeof item.code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(item.code)
      ? item.code
      : status === 401 ? 'SESSION_EXPIRED' : status === 429 ? 'RATE_LIMITED' : status >= 500 ? 'UNAVAILABLE' : 'VALIDATION',
    ...(typeof item.retryAt === 'string' ? { retryAt: item.retryAt } : {}),
    ...(Number.isInteger(item.attemptsRemaining) ? { attemptsRemaining: item.attemptsRemaining } : {}),
  };
}

export async function ownerWebBridge(request: Request, pathSegments: string | string[]) {
  const path = Array.isArray(pathSegments) ? pathSegments.join('/') : pathSegments;
  const route = ROUTES.find((candidate) => candidate.pattern.test(path) && candidate.methods.includes(request.method as never));
  if (!route) return json({ code: 'NOT_FOUND' }, 404);
  if (request.method !== 'GET' && !mutationAllowed(request)) return json({ code: 'ORIGIN_REJECTED' }, 403);
  const session = readSession(request);
  if (!('public' in route) && !session) return json({ code: 'SESSION_EXPIRED' }, 401, { 'set-cookie': clearCookie() });
  const base = process.env.VETHELP_API_BASE_URL;
  if (!base) return json({ code: 'UNAVAILABLE' }, 503);
  const body = request.method === 'GET' ? undefined : await request.arrayBuffer();
  if (body && body.byteLength > MAX_RESPONSE_BYTES) return json({ code: 'VALIDATION' }, 413);
  const headers: Record<string, string> = { accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}), ...(session ? { authorization: `Bearer ${session.credential}` } : {}) };
  for (const name of ['idempotency-key', 'if-match', 'x-correlation-id']) {
    const value = request.headers.get(name);
    if (value) headers[name] = value;
  }
  if (path === 'v1/auth/otp/request' || path === 'v1/auth/otp/resend') {
    try { Object.assign(headers, signedClientIp(request)); } catch { return json({ code: 'UNAVAILABLE' }, 503); }
  }
  let response: Response;
  try {
    const upstream = new URL(path, `${base.replace(/\/$/, '')}/`);
    if (request.method === 'GET') upstream.search = new URL(request.url).search;
    response = await fetch(upstream, { method: request.method, headers, body: body ? new Uint8Array(body) : undefined, redirect: 'manual', signal: AbortSignal.timeout(10_000) });
  } catch {
    return json({ code: 'UNAVAILABLE' }, 503);
  }
  if (response.status >= 300 && response.status < 400) return json({ code: 'UNAVAILABLE' }, 502);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_RESPONSE_BYTES) return json({ code: 'MALFORMED_RESPONSE' }, 502);
  let value: unknown;
  try {
    value = bytes.byteLength ? JSON.parse(new TextDecoder().decode(bytes)) : undefined;
  } catch {
    return json({ code: 'MALFORMED_RESPONSE' }, 502);
  }
  if (!response.ok) return json(safeError(response.status, value), response.status, response.status === 401 ? { 'set-cookie': clearCookie() } : {});
  if (path === 'v1/auth/otp/verify') {
    const item = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    const owner = item.owner && typeof item.owner === 'object' ? item.owner as Record<string, unknown> : {};
    const expiry = Date.parse(String(item.expiresAt));
    if (!SESSION_TOKEN.test(String(item.sessionToken)) || !Number.isFinite(expiry) || expiry <= Date.now() || typeof owner.id !== 'string') return json({ code: 'MALFORMED_RESPONSE' }, 502);
    const expiresAt = new Date(expiry).toISOString();
    return json({ expiresAt, owner: { id: owner.id } }, 200, { 'set-cookie': sessionCookie({ credential: String(item.sessionToken), expiresAt }) });
  }
  if (path === 'v1/auth/session') {
    const item = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    if (!session || typeof item.subjectId !== 'string' || !Array.isArray(item.roles)) return json({ code: 'MALFORMED_RESPONSE' }, 502);
    return json({ authenticated: true, subjectId: item.subjectId, roles: item.roles, expiresAt: session.expiresAt });
  }
  if (path === 'v1/auth/logout') return new Response(null, { status: 204, headers: { 'set-cookie': clearCookie(), 'cache-control': 'no-store' } });
  return json(value, response.status);
}
