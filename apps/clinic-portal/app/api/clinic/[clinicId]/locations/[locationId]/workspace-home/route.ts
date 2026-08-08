import { NextResponse } from 'next/server';
import { isClinicWorkspaceHomeEnabled } from '@/app/design-system/feature-flags';
import { canAccessClinicLocation, getClinicSession } from '@/lib/auth/clinic-session';
import { parseClinicWorkspaceHome } from '@/lib/api/clinic-workspace-home';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_RESPONSE_BYTES = 8 * 1024;
const UPSTREAM_TIMEOUT_MS = 3_000;
const SAFE_HEADERS = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } as const;

class InvalidBackendResponseError extends Error {}

type RouteContext = { params: Promise<{ clinicId: string; locationId: string }> };

function safe(code: string, status: number): NextResponse {
  const response = NextResponse.json({ code }, { status, headers: SAFE_HEADERS });
  response.headers.delete('ETag');
  return response;
}

function backendBaseUrl(): string {
  const value = process.env.VETHELP_API_BASE_URL;
  if (!value) throw new Error('backend unavailable');
  return value.replace(/\/$/, '');
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const declaredLength = response.headers.get('content-length');
  if (declaredLength !== null && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > MAX_RESPONSE_BYTES)) {
    throw new InvalidBackendResponseError();
  }
  if (!response.body) throw new InvalidBackendResponseError();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new InvalidBackendResponseError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new InvalidBackendResponseError();
  }
}

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  if (!isClinicWorkspaceHomeEnabled()) return safe('NOT_FOUND', 404);

  const { clinicId, locationId } = await context.params;
  if (!UUID.test(clinicId) || !UUID.test(locationId) || new URL(request.url).search.length > 0) {
    return safe('INVALID_WORKSPACE_ROUTE', 400);
  }

  const session = await getClinicSession();
  if (!session) return safe('SESSION_REQUIRED', 401);
  if (!canAccessClinicLocation(session, clinicId, locationId)) return safe('LOCATION_SCOPE_DENIED', 403);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch(
      `${backendBaseUrl()}/v1/clinic/${encodeURIComponent(clinicId)}/locations/${encodeURIComponent(locationId)}/workspace-home`,
      {
        headers: { Authorization: `Bearer ${session.token}`, Accept: 'application/json' },
        cache: 'no-store',
        redirect: 'manual',
        signal: controller.signal,
      },
    );
    if (response.status === 401) return safe('SESSION_REQUIRED', 401);
    if (response.status === 403) return safe('LOCATION_SCOPE_DENIED', 403);
    if (response.status >= 500) return safe('BACKEND_UNAVAILABLE', 503);
    if (response.status !== 200) return safe('BACKEND_UNAVAILABLE', 503);

    let payload: unknown;
    try {
      payload = await readBoundedJson(response);
    } catch (error) {
      if (!(error instanceof InvalidBackendResponseError)) throw error;
      return safe('INVALID_BACKEND_RESPONSE', 502);
    }
    try {
      payload = parseClinicWorkspaceHome(payload, { clinicId, locationId });
    } catch {
      return safe('INVALID_BACKEND_RESPONSE', 502);
    }
    const result = NextResponse.json(payload, { status: 200, headers: SAFE_HEADERS });
    result.headers.delete('ETag');
    return result;
  } catch {
    return safe('BACKEND_UNAVAILABLE', 503);
  } finally {
    clearTimeout(timeout);
  }
}
