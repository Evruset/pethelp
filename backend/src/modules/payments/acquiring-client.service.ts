import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { catchError, firstValueFrom, map, throwError, timeout } from 'rxjs';

export class AcquiringClientError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'AcquiringClientError';
  }
}

export interface RemotePaymentIntent {
  remoteId: string;
  checkoutUrl: string;
}

export interface RemoteRefundResult {
  refundId: string;
}

export type RemotePaymentState = 'PENDING' | 'VOIDED' | 'CAPTURED' | 'REFUNDED' | 'UNKNOWN';

interface RemoteIntentResponse {
  remoteId?: string;
  id?: string;
  checkoutUrl?: string;
  checkout_url?: string;
}

interface RemoteCaptureResponse {
  captured?: boolean;
  status?: string;
}

interface RemoteRefundResponse {
  refundId?: string;
  refund_id?: string;
  id?: string;
  status?: string;
}

@Injectable()
export class AcquiringClient {
  private static readonly REQUEST_TIMEOUT_MS = 3_500;

  constructor(private readonly http: HttpService) {}

  async createRemoteIntent(internalPaymentId: string, amount: number): Promise<RemotePaymentIntent> {
    const response = await firstValueFrom(
      this.http.post<RemoteIntentResponse>(
        `${this.baseUrl()}/v1/payment-intents`,
        { merchantPaymentId: internalPaymentId, amount },
        { headers: this.headers(internalPaymentId) },
      ).pipe(
        timeout(AcquiringClient.REQUEST_TIMEOUT_MS),
        map((result) => result.data),
        catchError((error: unknown) => throwError(() => new AcquiringClientError(this.message(error), error))),
      ),
    );

    const remoteId = response.remoteId ?? response.id;
    const checkoutUrl = response.checkoutUrl ?? response.checkout_url;
    if (!remoteId || !checkoutUrl) {
      throw new AcquiringClientError('Acquiring provider did not return remote intent id and checkout URL');
    }
    return { remoteId, checkoutUrl };
  }

  async captureRemoteIntent(remoteId: string, internalPaymentId: string): Promise<boolean> {
    const response = await firstValueFrom(
      this.http.post<RemoteCaptureResponse>(
        `${this.baseUrl()}/v1/payment-intents/${encodeURIComponent(remoteId)}/capture`,
        { merchantPaymentId: internalPaymentId },
        { headers: this.headers(`capture:${internalPaymentId}`) },
      ).pipe(
        timeout(AcquiringClient.REQUEST_TIMEOUT_MS),
        map((result) => result.data),
        catchError((error: unknown) => throwError(() => new AcquiringClientError(this.message(error), error))),
      ),
    );

    return response.captured === true || response.status?.toUpperCase() === 'CAPTURED';
  }

  async voidRemoteIntent(remoteId: string, internalPaymentId: string): Promise<void> {
    await firstValueFrom(
      this.http.post(
        `${this.baseUrl()}/v1/payment-intents/${encodeURIComponent(remoteId)}/void`,
        { merchantPaymentId: internalPaymentId },
        { headers: this.headers(`void:${internalPaymentId}`) },
      ).pipe(
        timeout(AcquiringClient.REQUEST_TIMEOUT_MS),
        map(() => undefined),
        catchError((error: unknown) => throwError(() => new AcquiringClientError(this.message(error), error))),
      ),
    );
  }

  /** Network call only; callers must run it outside database transactions. */
  async refundRemoteIntent(remoteId: string, amount: number, internalPaymentId: string): Promise<RemoteRefundResult> {
    const response = await firstValueFrom(
      this.http.post<RemoteRefundResponse>(
        `${this.baseUrl()}/v1/payment-intents/${encodeURIComponent(remoteId)}/refunds`,
        { merchantPaymentId: internalPaymentId, amount },
        { headers: this.headers(`refund:${internalPaymentId}`) },
      ).pipe(
        timeout(AcquiringClient.REQUEST_TIMEOUT_MS),
        map((result) => result.data),
        catchError((error: unknown) => throwError(() => new AcquiringClientError(this.message(error), error))),
      ),
    );

    const refundId = response.refundId ?? response.refund_id ?? response.id;
    if (!refundId) throw new AcquiringClientError('Acquiring provider did not return refund id');
    return { refundId };
  }

  async getRemoteIntentState(remoteId: string): Promise<RemotePaymentState> {
    const response = await firstValueFrom(
      this.http.get<{ status?: string }>(
        `${this.baseUrl()}/v1/payment-intents/${encodeURIComponent(remoteId)}`,
        { headers: this.headers() },
      ).pipe(
        timeout(AcquiringClient.REQUEST_TIMEOUT_MS),
        map((result) => result.data.status?.toUpperCase() ?? 'UNKNOWN'),
        catchError((error: unknown) => throwError(() => new AcquiringClientError(this.message(error), error))),
      ),
    );

    if (response === 'VOIDED') return 'VOIDED';
    if (response === 'CAPTURED') return 'CAPTURED';
    if (response === 'REFUNDED') return 'REFUNDED';
    if (response === 'PENDING' || response === 'AUTHORIZED') return 'PENDING';
    return 'UNKNOWN';
  }

  private headers(idempotencyKey?: string): Record<string, string> {
    const apiKey = process.env.ACQUIRING_API_KEY?.trim();
    if (!apiKey) throw new AcquiringClientError('ACQUIRING_API_KEY is not configured');

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    return headers;
  }

  private baseUrl(): string {
    const rawUrl = process.env.ACQUIRING_API_BASE_URL?.trim();
    const url = rawUrl?.replace(/\/$/, '');
    if (!url) throw new AcquiringClientError('ACQUIRING_API_BASE_URL is not configured');
    return url;
  }

  private message(error: unknown): string {
    return error instanceof Error ? error.message.slice(0, 1_000) : 'Acquiring provider request failed';
  }
}
