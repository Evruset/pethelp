export type BookingUuidFactory = () => string;

const defaultUuidFactory: BookingUuidFactory = () => crypto.randomUUID();

export class BookingRequestCoordinator {
  constructor(uuidFactory: BookingUuidFactory = defaultUuidFactory) {
    this.uuidFactory = uuidFactory;
  }

  private readonly uuidFactory: BookingUuidFactory;
  private readonly idempotencyKeysBySlot = new Map<string, string>();
  private correlationIdValue: string | null = null;

  get correlationId(): string {
    this.correlationIdValue ??= this.uuidFactory();
    return this.correlationIdValue;
  }

  headers(baseHeaders?: HeadersInit): Headers {
    const headers = new Headers(baseHeaders);
    headers.set('X-Correlation-Id', this.correlationId);
    return headers;
  }

  headersForAttempt(baseHeaders?: HeadersInit): Headers {
    const headers = this.headers(baseHeaders);
    setIdempotencyHeaders(headers, this.uuidFactory());
    return headers;
  }

  headersForSlot(slotId: string, baseHeaders?: HeadersInit): Headers {
    const headers = this.headers(baseHeaders);
    const idempotencyKey = this.idempotencyKeysBySlot.get(slotId) ?? this.uuidFactory();
    this.idempotencyKeysBySlot.set(slotId, idempotencyKey);
    setIdempotencyHeaders(headers, idempotencyKey);
    return headers;
  }

  releaseSlot(slotId: string): void {
    this.idempotencyKeysBySlot.delete(slotId);
  }

  resetSession(): void {
    this.correlationIdValue = null;
    this.idempotencyKeysBySlot.clear();
  }
}

function setIdempotencyHeaders(headers: Headers, idempotencyKey: string): void {
  headers.set('X-Idempotency-Key', idempotencyKey);
  headers.set('Idempotency-Key', idempotencyKey);
}
