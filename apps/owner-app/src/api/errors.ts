export type ApiErrorKind =
  | 'NETWORK'
  | 'TIMEOUT'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'VALIDATION'
  | 'SERVER'
  | 'UNEXPECTED_RESPONSE';

export class ApiError extends Error {
  constructor(
    public readonly kind: ApiErrorKind,
    message: string,
    public readonly status?: number,
    public readonly correlationId?: string,
    public readonly safeCode?: string,
    public readonly retryAt?: string,
    public readonly attemptsRemaining?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function kindForStatus(status: number): ApiErrorKind {
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 409) return 'CONFLICT';
  if (status === 400 || status === 422) return 'VALIDATION';
  if (status >= 500) return 'SERVER';
  return 'UNEXPECTED_RESPONSE';
}
