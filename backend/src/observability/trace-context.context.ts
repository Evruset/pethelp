import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';

export interface TraceContextValue {
  correlationId: string;
  userId?: string;
  causationId?: string;
  traceparent?: string;
  actorIp?: string;
  userAgent?: string;
}

const UUID_V4_OR_V5 = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TRACEPARENT = /^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/i;
const FORWARDED_FOR_SEPARATOR = ',';

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

  getCausationId(): string | undefined {
    return this.get()?.causationId;
  }

  getTraceparent(): string | undefined {
    return this.get()?.traceparent;
  }

  getActorIp(): string | undefined {
    return this.get()?.actorIp;
  }

  getUserAgent(): string | undefined {
    return this.get()?.userAgent;
  }

  setUserId(userId: string | undefined): void {
    const store = TraceContext.storage.getStore();
    if (store && userId) store.userId = userId;
  }

  correlationIdFromHeader(value: string | string[] | undefined): string {
    const candidate = Array.isArray(value) ? value[0] : value;
    return candidate && UUID_V4_OR_V5.test(candidate) ? candidate : randomUUID();
  }

  causationIdFromHeader(value: string | string[] | undefined): string | undefined {
    const candidate = Array.isArray(value) ? value[0] : value;
    return candidate && UUID_V4_OR_V5.test(candidate) ? candidate : undefined;
  }

  traceparentFromHeader(value: string | string[] | undefined): string | undefined {
    const candidate = Array.isArray(value) ? value[0] : value;
    return candidate && TRACEPARENT.test(candidate) ? candidate.toLowerCase() : undefined;
  }

  actorIpFromRequest(ip: string | undefined, forwardedFor: string | string[] | undefined): string | undefined {
    const forwardedCandidate = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    const candidate = forwardedCandidate?.split(FORWARDED_FOR_SEPARATOR)[0]?.trim() || ip?.trim();
    return candidate && isIP(candidate) ? candidate : undefined;
  }

  userAgentFromHeader(value: string | string[] | undefined): string | undefined {
    const candidate = Array.isArray(value) ? value[0] : value;
    return candidate?.trim().slice(0, 512) || undefined;
  }

  workerContext(
    correlationId: string | null | undefined,
    options: { causationId?: string | null; traceparent?: string | null } = {},
  ): TraceContextValue {
    const context: TraceContextValue = {
      correlationId: correlationId && UUID_V4_OR_V5.test(correlationId) ? correlationId : randomUUID(),
    };
    if (options.causationId && UUID_V4_OR_V5.test(options.causationId)) {
      context.causationId = options.causationId;
    }
    if (options.traceparent && TRACEPARENT.test(options.traceparent)) {
      context.traceparent = options.traceparent.toLowerCase();
    }
    return context;
  }
}
