import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export interface TraceContextValue {
  correlationId: string;
  userId?: string;
}

const UUID_V4_OR_V5 = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class TraceContext {
  private static readonly storage = new AsyncLocalStorage<TraceContextValue>();

  run<T>(context: TraceContextValue, work: () => T): T {
    return TraceContext.storage.run({ ...context }, work);
  }

  get(): TraceContextValue | undefined {
    return TraceContext.storage.getStore();
  }

  getCorrelationId(): string | undefined {
    return this.get()?.correlationId;
  }

  getUserId(): string | undefined {
    return this.get()?.userId;
  }

  setUserId(userId: string | undefined): void {
    const store = TraceContext.storage.getStore();
    if (store && userId) store.userId = userId;
  }

  correlationIdFromHeader(value: string | string[] | undefined): string {
    const candidate = Array.isArray(value) ? value[0] : value;
    return candidate && UUID_V4_OR_V5.test(candidate) ? candidate : randomUUID();
  }

  workerContext(correlationId: string | null | undefined): TraceContextValue {
    return { correlationId: correlationId && UUID_V4_OR_V5.test(correlationId) ? correlationId : randomUUID() };
  }
}
