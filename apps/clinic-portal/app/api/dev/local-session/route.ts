import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, open, readFile, readdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { CLINIC_SESSION_COOKIE, createClinicSessionToken, type ClinicSession } from '@/lib/auth/clinic-session';
import { getEffectiveSession } from '@/lib/auth/effective-session';
import { isDevLocalSessionEnabled } from '@/lib/auth/local-session-policy';

export function startPath(session: ClinicSession): string {
  const base = `/clinics/${session.clinicIds[0]}/locations/${session.locationIds[0]}`;
  const hasAdministrativeRole =
    session.roles.includes('CLINIC_RECEPTIONIST') ||
    session.roles.includes('CLINIC_ADMIN');
  const hasVeterinarianRole = session.roles.includes('CLINIC_VETERINARIAN');

  return hasVeterinarianRole && !hasAdministrativeRole
    ? `${base}/vet/visits`
    : `${base}/queue`;
}

type DemoProfile = {
  key: string; employeeId: string; tokenRoles: string[];
  clinicIds: string[]; locationIds: string[]; expectedAccess: boolean;
};
type CodeRecord = { profile: DemoProfile; origin: string; returnPath: string; expiresAt: number };

function artifactDir(): string {
  const configured = process.env.VETHELP_DEV_SESSION_CODE_DIR;
  if (!configured) throw new Error('VETHELP_DEV_SESSION_CODE_DIR is not configured');
  return configured;
}
function digest(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}
function safeReturnPath(value: unknown, profile: DemoProfile): string {
  const session = { token: '', userId: profile.employeeId, roles: profile.tokenRoles, clinicIds: profile.clinicIds, locationIds: profile.locationIds };
  const canonical = startPath(session);
  return typeof value === 'string' && value === canonical ? value : canonical;
}
function requestOrigin(request: Request): string | null {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin || !host) return null;
  try {
    const originUrl = new URL(origin);
    return originUrl.protocol === 'http:' &&
      ['127.0.0.1', 'localhost', '::1'].includes(originUrl.hostname) &&
      originUrl.host === host
      ? originUrl.origin
      : null;
  } catch {
    return null;
  }
}
async function profiles(): Promise<DemoProfile[]> {
  const seedPath = process.env.VETHELP_DEV_SESSION_SEED_JSON;
  if (!seedPath) throw new Error('VETHELP_DEV_SESSION_SEED_JSON is not configured');
  const parsed = JSON.parse(await readFile(seedPath, 'utf8')) as { employees?: DemoProfile[] };
  return Array.isArray(parsed.employees) ? parsed.employees : [];
}
async function issue(profile: DemoProfile, origin: string, returnPath: unknown): Promise<string> {
  const code = randomBytes(32).toString('base64url');
  const dir = artifactDir();
  await mkdir(dir, { recursive: true, mode: 0o700 });
  for (const name of await readdir(dir)) {
    const candidate = path.join(dir, name);
    const metadata = await stat(candidate).catch(() => null);
    if (metadata && Date.now() - metadata.mtimeMs > 60_000) await rm(candidate, { force: true });
  }
  const record: CodeRecord = { profile, origin, returnPath: safeReturnPath(returnPath, profile), expiresAt: Date.now() + 45_000 };
  const file = path.join(dir, `${digest(code)}.json`);
  const handle = await open(`${file}.tmp`, 'wx', 0o600);
  try { await handle.writeFile(JSON.stringify(record)); } finally { await handle.close(); }
  await rename(`${file}.tmp`, file);
  return code;
}
async function consume(code: unknown, origin: string): Promise<CodeRecord | null> {
  if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(code)) return null;
  const file = path.join(artifactDir(), `${digest(code)}.json`);
  const claimed = `${file}.${process.pid}.${randomBytes(6).toString('hex')}.used`;
  try {
    await rename(file, claimed);
    const record = JSON.parse(await readFile(claimed, 'utf8')) as CodeRecord;
    await rm(claimed, { force: true });
    return record.origin === origin && record.expiresAt >= Date.now() ? record : null;
  } catch {
    await rm(claimed, { force: true }).catch(() => undefined);
    return null;
  }
}

function setClinicSessionCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set({
    name: CLINIC_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.VETHELP_DEV_SESSION_SECURE_COOKIE === 'true',
    path: '/',
    maxAge: 30 * 60,
  });
  return response;
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!isDevLocalSessionEnabled()) {
    return NextResponse.json({ code: 'NOT_FOUND' }, { status: 404 });
  }

  const origin = requestOrigin(request);
  if (!origin) return NextResponse.json({ code: 'INVALID_LOCAL_SESSION' }, { status: 401 });
  const body = await request.json().catch(() => null) as { action?: unknown; profileKey?: unknown; code?: unknown; returnPath?: unknown } | null;
  if (body?.action === 'issue' && typeof body.profileKey === 'string') {
    const profile = (await profiles()).find((item) => item.key === body.profileKey);
    if (!profile) return NextResponse.json({ code: 'INVALID_LOCAL_SESSION' }, { status: 401 });
    return NextResponse.json({ code: await issue(profile, origin, body.returnPath), expiresIn: 45 }, { headers: { 'Cache-Control': 'no-store' } });
  }
  if (body?.action !== 'exchange') return NextResponse.json({ code: 'INVALID_REQUEST' }, { status: 400 });
  const record = await consume(body.code, origin);
  if (!record || !record.profile.expectedAccess) return NextResponse.json({ code: 'INVALID_LOCAL_SESSION' }, { status: 401 });
  const token = await createClinicSessionToken({
    userId: record.profile.employeeId,
    roles: record.profile.tokenRoles,
    clinicIds: record.profile.clinicIds,
    locationIds: record.profile.locationIds,
  });
  const session: ClinicSession = { token, userId: record.profile.employeeId, roles: record.profile.tokenRoles, clinicIds: record.profile.clinicIds, locationIds: record.profile.locationIds };
  try {
    const effective = await getEffectiveSession(session);
    const expectedScopes = record.profile.clinicIds.flatMap((clinicId) => record.profile.locationIds.map((locationId) => `${clinicId}:${locationId}`)).sort();
    const actualScopes = effective.clinicScopes.map((scope) => `${scope.clinicId}:${scope.locationId}`).sort();
    if (effective.subjectId !== session.userId ||
        JSON.stringify([...effective.roles].sort()) !== JSON.stringify([...session.roles].sort()) ||
        JSON.stringify(actualScopes) !== JSON.stringify(expectedScopes)) {
      return NextResponse.json({ code: 'INVALID_LOCAL_SESSION' }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ code: 'INVALID_LOCAL_SESSION' }, { status: 401 });
  }
  return setClinicSessionCookie(NextResponse.json({
    clinicId: session.clinicIds[0], locationId: session.locationIds[0], startPath: record.returnPath,
  }, { headers: { 'Cache-Control': 'no-store' } }), token);
}

export async function GET(): Promise<NextResponse> {
  if (!isDevLocalSessionEnabled()) return NextResponse.json({ code: 'NOT_FOUND' }, { status: 404 });
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>VetHelp local session</title></head><body><p id="status">Проверка локальной сессии…</p><script>
  (async()=>{try{
    const profile=new URLSearchParams(location.hash.slice(1)).get('profile'); history.replaceState(null,'',location.pathname);
    if(!profile)throw new Error('INVALID_PROFILE');
    const options=(body)=>({method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const issued=await fetch(location.pathname,options({action:'issue',profileKey:profile})); const a=await issued.json();
    if(!issued.ok)throw new Error(a.code);
    const exchanged=await fetch(location.pathname,options({action:'exchange',code:a.code})); const b=await exchanged.json();
    if(!exchanged.ok)throw new Error(b.code);
    location.replace(b.startPath);
  }catch(e){document.getElementById('status').textContent='Local session denied';}})();
  </script></body></html>`;
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; connect-src 'self'",
    },
  });
}

export async function DELETE(): Promise<NextResponse> {
  if (!isDevLocalSessionEnabled()) {
    return NextResponse.json({ code: 'NOT_FOUND' }, { status: 404 });
  }
  const response = new NextResponse(null, { status: 204 });
  response.cookies.set({ name: CLINIC_SESSION_COOKIE, value: '', path: '/', maxAge: 0 });
  return response;
}
