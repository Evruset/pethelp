/* eslint-disable @typescript-eslint/no-require-imports */

describe('owner pet archival migration', () => {
  const migration = require('../../migrations/node-pg/1719420000000_add_pet_archival.js');

  it('is additive and repeatable for empty and populated pet tables', () => {
    const pgm = { sql: jest.fn() };
    migration.up(pgm);
    migration.up(pgm);
    expect(pgm.sql).toHaveBeenCalledTimes(2);
    const sql = pgm.sql.mock.calls[0][0] as string;
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS archived_at timestamptz');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS pets_owner_active_created_idx');
    expect(sql).not.toMatch(/DELETE|DROP COLUMN|UPDATE pet_schema\.pets/i);
  });

  it('uses a forward-only down policy that cannot reactivate or delete pets', () => {
    expect(migration.down()).toBeUndefined();
  });
});
