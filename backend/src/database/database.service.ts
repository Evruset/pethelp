import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { config } from '../config';
import { TraceContext } from '../observability/trace-context.context';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly pool = new Pool({
    connectionString: config.databaseUrl,
    max: 20,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 700,
  });

  private readonly traceContext = new TraceContext();

  async query<T extends QueryResultRow = QueryResultRow>(text: string, values: readonly unknown[] = []): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, [...values]);
  }

  poolStats(): { totalCount: number; idleCount: number; waitingCount: number; inUseCount: number } {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
      inUseCount: this.pool.totalCount - this.pool.idleCount,
    };
  }

  async withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await this.applyTraceContext(client);
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Preserve the original database exception.
      }
      throw error;
    } finally {
      client.release();
    }
  }

  private async applyTraceContext(client: PoolClient): Promise<void> {
    const settings: Array<[string, string | undefined]> = [
      ['app.correlation_id', this.traceContext.getCorrelationId()],
      ['app.causation_id', this.traceContext.getCausationId()],
      ['app.traceparent', this.traceContext.getTraceparent()],
      ['app.actor_ip', this.traceContext.getActorIp()],
      ['app.user_agent', this.traceContext.getUserAgent()],
    ];

    for (const [name, value] of settings) {
      if (value) await client.query('SELECT set_config($1, $2, true)', [name, value]);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
