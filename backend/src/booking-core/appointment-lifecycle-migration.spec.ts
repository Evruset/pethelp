const migration = require('../../migrations/node-pg/1719660000000_add_appointment_lifecycle');
export {};

describe('appointment lifecycle migration', () => {
  it('adds an additive appointment authority model without fabricating unknown history', () => {
    const pgm = { sql: jest.fn() };
    migration.up(pgm);
    const sql = pgm.sql.mock.calls[0][0] as string;
    expect(sql).toContain('ADD COLUMN lifecycle_state text');
    expect(sql).toContain("ELSE NULL");
    expect(sql).toContain("'CANCELLED_BY_USER','CANCELLED_BY_CLINIC','RESCHEDULE_PROPOSED','NO_SHOW'");
    expect(sql).toContain('ADD COLUMN appointment_id uuid');
  });

  it('refuses destructive lifecycle-history rollback', () => {
    expect(() => migration.down()).toThrow('IRREVERSIBLE_APPOINTMENT_LIFECYCLE_HISTORY');
  });
});
