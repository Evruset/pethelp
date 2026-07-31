import type { PoolClient } from 'pg';
import { DatabaseService } from '../src/database/database.service';
import { TraceContext } from '../src/observability/trace-context.context';

describe('Database transaction options', () => {
  let database: DatabaseService;
  let query: jest.Mock;
  let release: jest.Mock;

  beforeEach(() => {
    database = new DatabaseService();
    query = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    release = jest.fn();
    const client = { query, release } as unknown as PoolClient;
    const pool = database.pool as unknown as { connect: () => Promise<PoolClient> };
    jest.spyOn(pool, 'connect').mockResolvedValue(client);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await database.onModuleDestroy();
  });

  it('preserves the default transaction behavior and releases after commit', async () => {
    const result = await database.withTransaction(async (client) => {
      await client.query('SELECT work');
      return 'done';
    });

    expect(result).toBe('done');
    expect(query.mock.calls.map(([text]) => text)).toEqual([
      'BEGIN',
      'SELECT work',
      'COMMIT',
    ]);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('starts repeatable-read read-only mode before applying trace context', async () => {
    jest.spyOn(TraceContext.prototype, 'getCorrelationId').mockReturnValue('correlation-1');

    await database.withTransaction(async (client) => {
      await client.query('SELECT work');
    }, {
      isolationLevel: 'REPEATABLE READ',
      readOnly: true,
    });

    expect(query.mock.calls).toEqual([
      ['BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'],
      ['SELECT set_config($1, $2, true)', ['app.correlation_id', 'correlation-1']],
      ['SELECT work'],
      ['COMMIT'],
    ]);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('rolls back and releases when transaction work fails', async () => {
    const failure = new Error('work failed');

    await expect(database.withTransaction(async () => {
      throw failure;
    })).rejects.toBe(failure);

    expect(query.mock.calls.map(([text]) => text)).toEqual([
      'BEGIN',
      'ROLLBACK',
    ]);
    expect(query).not.toHaveBeenCalledWith('COMMIT');
    expect(release).toHaveBeenCalledTimes(1);
  });
});
