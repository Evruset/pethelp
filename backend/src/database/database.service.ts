import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { config } from '../config';
import { TraceContext } from '../observability/trace-context.context';

export type TransactionIsolationLevel = 'READ COMMITTED' | 'REPEATABLE READ';

export interface TransactionOptions {
  isolationLevel?: TransactionIsolationLevel;
  readOnly?: boolean;
}

const BEGIN = 'BEGIN';
const BEGIN_READ_ONLY = 'BEGIN READ ONLY';
const BEGIN_READ_COMMITTED = 'BEGIN ISOLATION LEVEL READ COMMITTED';
const BEGIN_READ_COMMITTED_READ_ONLY = 'BEGIN ISOLATION LEVEL READ COMMITTED READ ONLY';
const BEGIN_REPEATABLE_READ = 'BEGIN ISOLATION LEVEL REPEATABLE READ';
const BEGIN_REPEATABLE_READ_READ_ONLY = 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY';

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

  async withTransaction<T>(
    work: (client: PoolClient) => Promise<T>,
    options: TransactionOptions = {},
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query(this.beginStatement(options));
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

  private beginStatement(options: TransactionOptions): string {
    if (options.isolationLevel === 'REPEATABLE READ') {
      return options.readOnly ? BEGIN_REPEATABLE_READ_READ_ONLY : BEGIN_REPEATABLE_READ;
    }
    if (options.isolationLevel === 'READ COMMITTED') {
      return options.readOnly ? BEGIN_READ_COMMITTED_READ_ONLY : BEGIN_READ_COMMITTED;
    }
    return options.readOnly ? BEGIN_READ_ONLY : BEGIN;
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
