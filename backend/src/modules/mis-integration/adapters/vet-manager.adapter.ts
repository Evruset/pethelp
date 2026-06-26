import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { catchError, firstValueFrom, map, of, throwError, timeout } from 'rxjs';
import { config } from '../../../config';
import {
  IMisAdapter,
  MisConfigurationError,
  MisNetworkError,
  MisReservationLookupRequest,
  MisReservationLookupResult,
  MisReservationRequest,
  MisReservationResult,
} from '../interfaces/mis-adapter.interface';

interface VetManagerReservationResponse {
  success?: boolean;
  status?: string;
  externalHoldId?: string;
  external_hold_id?: string;
  holdId?: string;
  hold_id?: string;
  id?: string;
  ttlMinutes?: number;
  ttl_minutes?: number;
  error?: string;
  message?: string;
}

@Injectable()
export class VetManagerAdapter implements IMisAdapter {
  constructor(private readonly http: HttpService) {}

  async reserve(request: MisReservationRequest): Promise<MisReservationResult> {
    const baseUrl = config.misVetManagerBaseUrl;
    if (!baseUrl) {
      throw new MisConfigurationError('MIS_VET_MANAGER_BASE_URL is not configured');
    }

    const url = `${baseUrl.replace(/\/$/, '')}/api/v1/reservations`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Idempotency-Key': request.internalHoldId,
    };
    if (request.correlationId) headers['X-Correlation-ID'] = request.correlationId;
    if (config.misVetManagerApiKey) headers['X-API-Key'] = config.misVetManagerApiKey;

    return firstValueFrom(
      this.http.post<VetManagerReservationResponse>(
        url,
        {
          reservationId: request.internalHoldId,
          slotId: request.slotId,
          clinicId: request.clinicId,
          patientId: request.externalPatientId,
        },
        { headers },
      ).pipe(
        timeout(4_000),
        map((response) => this.toReservationResult(response.data)),
        catchError((error: unknown) => {
          const responseStatus = this.responseStatus(error);
          if (responseStatus && responseStatus >= 400 && responseStatus < 500) {
            return of({
              status: 'FAILED' as const,
              rawError: `VetManager rejected reservation with HTTP ${responseStatus}`,
            });
          }
          return throwError(() => new MisNetworkError(this.toMessage(error), error));
        }),
      ),
    );
  }

  async lookupReservation(request: MisReservationLookupRequest): Promise<MisReservationLookupResult> {
    const baseUrl = config.misVetManagerBaseUrl;
    if (!baseUrl) {
      throw new MisConfigurationError('MIS_VET_MANAGER_BASE_URL is not configured');
    }

    const url = `${baseUrl.replace(/\/$/, '')}/api/v1/reservations/${encodeURIComponent(request.internalHoldId)}`;
    const headers: Record<string, string> = {
      'Idempotency-Key': request.internalHoldId,
    };
    if (request.correlationId) headers['X-Correlation-ID'] = request.correlationId;
    if (config.misVetManagerApiKey) headers['X-API-Key'] = config.misVetManagerApiKey;

    return firstValueFrom(
      this.http.get<VetManagerReservationResponse>(url, { headers }).pipe(
        timeout(4_000),
        map((response) => this.toLookupResult(response.data)),
        catchError((error: unknown) => {
          const responseStatus = this.responseStatus(error);
          if (responseStatus === 404) {
            return of({
              status: 'NOT_FOUND' as const,
              rawError: 'VetManager reservation was not found',
            });
          }
          if (responseStatus && responseStatus >= 400 && responseStatus < 500) {
            return of({
              status: 'FAILED' as const,
              rawError: `VetManager lookup rejected reservation with HTTP ${responseStatus}`,
            });
          }
          return throwError(() => new MisNetworkError(this.toMessage(error), error));
        }),
      ),
    );
  }

  private toReservationResult(body: VetManagerReservationResponse): MisReservationResult {
    const externalHoldId = body.externalHoldId ?? body.external_hold_id ?? body.holdId ?? body.hold_id ?? body.id;
    const failed = body.success === false || body.status?.toUpperCase() === 'FAILED';
    if (failed || !externalHoldId) {
      return {
        status: 'FAILED',
        rawError: body.error ?? body.message ?? 'VetManager did not return external hold id',
      };
    }

    const ttlCandidate = body.ttlMinutes ?? body.ttl_minutes;
    const ttlMinutes = typeof ttlCandidate === 'number' && ttlCandidate > 0 ? ttlCandidate : undefined;
    return { status: 'SUCCESS', externalHoldId, ttlMinutes };
  }

  private toLookupResult(body: VetManagerReservationResponse): MisReservationLookupResult {
    const externalHoldId = body.externalHoldId ?? body.external_hold_id ?? body.holdId ?? body.hold_id ?? body.id;
    const status = body.status?.toUpperCase();
    const failed = body.success === false || status === 'FAILED' || status === 'REJECTED';
    if (failed) {
      return {
        status: 'FAILED',
        rawError: body.error ?? body.message ?? 'VetManager reservation lookup returned failure',
      };
    }
    if (!externalHoldId) {
      return {
        status: 'UNKNOWN',
        rawError: body.error ?? body.message ?? 'VetManager reservation lookup did not return external hold id',
      };
    }

    const ttlCandidate = body.ttlMinutes ?? body.ttl_minutes;
    const ttlMinutes = typeof ttlCandidate === 'number' && ttlCandidate > 0 ? ttlCandidate : undefined;
    return { status: 'SUCCESS', externalHoldId, ttlMinutes };
  }

  private responseStatus(error: unknown): number | undefined {
    if (typeof error !== 'object' || error === null || !('response' in error)) return undefined;
    const response = (error as { response?: { status?: unknown } }).response;
    return typeof response?.status === 'number' ? response.status : undefined;
  }

  private toMessage(error: unknown): string {
    if (error instanceof Error) return error.message.slice(0, 1000);
    return 'VetManager network request failed';
  }
}
