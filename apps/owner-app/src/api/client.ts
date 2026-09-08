import { appConfig } from '@/config/env';
import { ApiError, kindForStatus } from './errors';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type RequestOptions<TBody> = Readonly<{
  method?: Method;
  body?: TBody;
  headers?: Readonly<Record<string, string>>;
  signal?: AbortSignal;
  timeoutMs?: number;
}>;

export type ApiClient = {
  request<TResponse, TBody = never>(path: string, options?: RequestOptions<TBody>): Promise<TResponse>;
};

export function createApiClient(
  baseUrl = appConfig.apiBaseUrl,
  transport: typeof fetch = fetch,
): ApiClient {
  return {
    async request<TResponse, TBody = never>(path: string, options: RequestOptions<TBody> = {}) {
      if (options.signal?.aborted) {
        throw new ApiError('NETWORK', 'The network request was cancelled.');
      }
      const controller = new AbortController();
      const timeoutMs = options.timeoutMs ?? 10_000;
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const abort = () => controller.abort();
      options.signal?.addEventListener('abort', abort, { once: true });
      try {
        const response = await transport(new URL(path, `${baseUrl}/`), {
          method: options.method ?? 'GET',
          headers: { Accept: 'application/json', ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }), ...options.headers },
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
          signal: controller.signal,
        });
        const correlationId = response.headers.get('x-correlation-id') ?? response.headers.get('x-request-id') ?? undefined;
        if (!response.ok) {
          let safeCode: string | undefined;
          let retryAt: string | undefined;
          let attemptsRemaining: number | undefined;
          try {
            const errorBody: unknown = await response.json();
            if (typeof errorBody === 'object' && errorBody !== null) {
              const candidate = errorBody as Record<string, unknown>;
              if (typeof candidate.code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(candidate.code)) safeCode = candidate.code;
              if (typeof candidate.retryAt === 'string' && Number.isFinite(Date.parse(candidate.retryAt))) retryAt = candidate.retryAt;
              if (Number.isInteger(candidate.attemptsRemaining) && Number(candidate.attemptsRemaining) >= 0 && Number(candidate.attemptsRemaining) <= 5) attemptsRemaining = Number(candidate.attemptsRemaining);
            }
          } catch {
            // Error bodies are optional and never shown directly.
          }
          throw new ApiError(kindForStatus(response.status), 'The request could not be completed.', response.status, correlationId, safeCode, retryAt, attemptsRemaining);
        }
        const text = await response.text();
        let payload: unknown;
        try {
          payload = text === '' ? undefined : JSON.parse(text);
        } catch {
          throw new ApiError('UNEXPECTED_RESPONSE', 'The server returned an invalid response.', response.status, correlationId);
        }
        return payload as TResponse;
      } catch (error) {
        if (error instanceof ApiError) throw error;
        if (controller.signal.aborted && !options.signal?.aborted) throw new ApiError('TIMEOUT', 'The request timed out.');
        throw new ApiError('NETWORK', 'The network request failed.');
      } finally {
        clearTimeout(timeout);
        options.signal?.removeEventListener('abort', abort);
      }
    },
  };
}

export const apiClient = createApiClient();
