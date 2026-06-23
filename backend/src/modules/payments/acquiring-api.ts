import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { catchError, firstValueFrom, map, throwError, timeout } from 'rxjs';

export class AcquiringNetworkError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'AcquiringNetworkError';
  }
}

export type AcquiringPaymentState = 'VOIDED' | 'PENDING' | 'UNKNOWN';

@Injectable()
export class AcquiringApi {
  constructor(private readonly http: HttpService) {}

  async void(paymentIntentId: string, idempotencyKey: string): Promise<void> {
    const baseUrl = this.baseUrl();
    await firstValueFrom(
      this.http.post(
        `${baseUrl}/v1/payments/${paymentIntentId}/void`,
        { paymentIntentId },
        { headers: this.headers(idempotencyKey) },
      ).pipe(
        timeout(4_000),
        map(() => undefined),
        catchError((error: unknown) => throwError(() => new AcquiringNetworkError(this.message(error), error))),
      ),
    );
  }

  async getPaymentState(paymentIntentId: string): Promise<AcquiringPaymentState> {
    const baseUrl = this.baseUrl();
    return firstValueFrom(
      this.http.get<{ status?: string }>(`${baseUrl}/v1/payments/${paymentIntentId}`, {
        headers: this.headers(),
      }).pipe(
        timeout(4_000),
        map((response) => {
          const status = response.data.status?.toUpperCase();
          return status === 'VOIDED' ? 'VOIDED' : status === 'PENDING' ? 'PENDING' : 'UNKNOWN';
        }),
        catchError((error: unknown) => throwError(() => new AcquiringNetworkError(this.message(error), error))),
      ),
    );
  }

  private baseUrl(): string {
    const baseUrl = process.env.ACQUIRING_API_BASE_URL?.replace(/\/$/, '');
    if (!baseUrl) throw new AcquiringNetworkError('ACQUIRING_API_BASE_URL is not configured');
    return baseUrl;
  }

  private headers(idempotencyKey?: string): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const apiKey = process.env.ACQUIRING_API_KEY?.trim();
    if (apiKey) headers['X-API-Key'] = apiKey;
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    return headers;
  }

  private message(error: unknown): string {
    return error instanceof Error ? error.message.slice(0, 1000) : 'Acquiring provider request failed';
  }
}
