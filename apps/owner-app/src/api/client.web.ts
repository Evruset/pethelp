import { ApiError, kindForStatus } from './errors';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type RequestOptions<TBody> = Readonly<{ method?: Method; body?: TBody; headers?: Readonly<Record<string, string>>; signal?: AbortSignal; timeoutMs?: number }>;
export type ApiClient = { request<TResponse, TBody = never>(path: string, options?: RequestOptions<TBody>): Promise<TResponse> };

const ALLOWED = [
  /^v1\/owner\/pets$/,
  /^v1\/owner\/pets\/[0-9a-f-]{36}\/diary\?limit=100&offset=0$/,
  /^v1\/owner\/clinic-catalog$/,
  /^v1\/owner\/clinic-catalog\/[0-9a-f-]{36}\/locations\/[0-9a-f-]{36}$/,
  /^v1\/owner\/clinic-catalog\/[0-9a-f-]{36}\/locations\/[0-9a-f-]{36}\/services\/[0-9a-f-]{36}\/availability$/,
  /^v1\/booking-holds$/,
  /^v1\/booking-holds\/[0-9a-f-]{36}$/,
  /^v1\/owner\/bookings\/[0-9a-f-]{36}\/cancel$/,
];

export function createApiClient(_baseUrl?: string, transport: typeof fetch = fetch): ApiClient {
  return { async request<TResponse, TBody = never>(path: string, options: RequestOptions<TBody> = {}) {
    const normalized = path.replace(/^\//, '');
    if (!ALLOWED.some((pattern) => pattern.test(normalized))) throw new ApiError('UNEXPECTED_RESPONSE', 'Owner Web route is not allowlisted.');
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000); const abort = () => controller.abort(); options.signal?.addEventListener('abort', abort, { once: true });
    try {
      const headers = { Accept: 'application/json', ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }), ...Object.fromEntries(Object.entries(options.headers ?? {}).filter(([name]) => name.toLowerCase() !== 'authorization')) };
      const response = await transport(`/api/owner/${normalized}`, { method: options.method ?? 'GET', credentials: 'same-origin', headers, body: options.body === undefined ? undefined : JSON.stringify(options.body), signal: controller.signal });
      const correlationId = response.headers.get('x-correlation-id') ?? undefined;
      if (!response.ok) { let value: unknown; try { value = await response.json(); } catch {} const item = value && typeof value === 'object' ? value as Record<string, unknown> : {}; throw new ApiError(kindForStatus(response.status), 'The request could not be completed.', response.status, correlationId, typeof item.code === 'string' ? item.code : undefined, typeof item.retryAt === 'string' ? item.retryAt : undefined, Number.isInteger(item.attemptsRemaining) ? Number(item.attemptsRemaining) : undefined); }
      const text = await response.text(); try { return (text === '' ? undefined : JSON.parse(text)) as TResponse; } catch { throw new ApiError('UNEXPECTED_RESPONSE', 'The server returned an invalid response.', response.status, correlationId); }
    } catch (error) { if (error instanceof ApiError) throw error; if (controller.signal.aborted && !options.signal?.aborted) throw new ApiError('TIMEOUT', 'The request timed out.'); throw new ApiError('NETWORK', 'The network request failed.'); }
    finally { clearTimeout(timeout); options.signal?.removeEventListener('abort', abort); }
  } };
}

export const apiClient = createApiClient();
