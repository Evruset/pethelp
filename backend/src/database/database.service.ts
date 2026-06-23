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
    const correlationId = this.traceContext.getCorrelationId();
    if (!correlationId) return;
    await client.query(`SELECT set_config('app.correlation_id', $1, true)`, [correlationId]);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
