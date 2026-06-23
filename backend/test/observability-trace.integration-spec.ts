import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { DatabaseService } from '../src/database/database.service';
import { ContextLoggerService } from '../src/observability/context-logger.service';
import { TraceContext } from '../src/observability/trace-context.context';
import { TraceMiddleware } from '../src/observability/trace.middleware';

jest.setTimeout(30_000);

describe('Observability trace context', () => {
  const traceContext = new TraceContext();

  it('creates ALS context and returns X-Correlation-ID from HTTP middleware', async () => {
    const middleware = new TraceMiddleware(traceContext);
    const correlationId = randomUUID();
    const responseHeaders = new Map<string, string>();
    const request = {
      headers: { 'x-correlation-id': correlationId },
    } as unknown as Request;
    const response = {
      setHeader: jest.fn((name: string, value: string) => responseHeaders.set(name, value)),
    } as unknown as Response;

    await new Promise<void>((resolve) => {
      middleware.use(request, response, (() => {
        expect(traceContext.getCorrelationId()).toBe(correlationId);
        resolve();
      }) as NextFunction);
    });

    expect(responseHeaders.get('X-Correlation-ID')).toBe(correlationId);
  });

  it('emits strict JSON with context fields in production mode', () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const logger = new ContextLoggerService(traceContext);
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const correlationId = randomUUID();
    const userId = randomUUID();

    traceContext.run({ correlationId, userId }, () => {
      logger.event('log', 'BookingCore', 'Creating local hold', { slotId: 'slot-1' });
    });

    const line = String(consoleSpy.mock.calls[0][0]);
    expect(JSON.parse(line)).toMatchObject({
      level: 'info',
      context: 'BookingCore',
      message: 'Creating local hold',
      correlationId,
      userId,
      slotId: 'slot-1',
    });

    consoleSpy.mockRestore();
    process.env.NODE_ENV = previousNodeEnv;
  });

  it('sets outbox correlation_id from active transaction trace context', async () => {
    const database = new DatabaseService();
    const correlationId = randomUUID();
    const aggregateId = randomUUID();

    try {
      await traceContext.run({ correlationId }, async () => {
        await database.withTransaction(async (client) => {
          await client.query(`
            INSERT INTO booking_schema.outbox_events (
              event_type, aggregate_type, aggregate_id,
              aggregate_version, payload_json, deduplication_key
            ) VALUES (
              'observability.test.v1', 'test', $1::uuid,
              1, '{}'::jsonb, $2
            )
          `, [aggregateId, `observability:${aggregateId}`]);
        });
      });

      const result = await database.query<{ correlation_id: string | null }>(`
        SELECT correlation_id::text AS correlation_id
        FROM booking_schema.outbox_events
        WHERE deduplication_key = $1
      `, [`observability:${aggregateId}`]);
      expect(result.rows[0]?.correlation_id).toBe(correlationId);
    } finally {
      await database.query(`DELETE FROM booking_schema.outbox_events WHERE deduplication_key = $1`, [`observability:${aggregateId}`]);
      await database.onModuleDestroy();
    }
  });
});
