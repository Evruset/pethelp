const migration = require('../../migrations/node-pg/1719650000000_protect_clinic_booking_contract_profile_audit');

describe('clinic contract profile audit protection migration', () => {
  it('protects audit rows and records only the database session role as actor', () => {
    const pgm = { sql: jest.fn() };
    migration.up(pgm);
    const sql = pgm.sql.mock.calls[0][0] as string;
    expect(sql).toContain('BEFORE UPDATE OR DELETE');
    expect(sql).toContain('BEFORE TRUNCATE');
    expect(sql).toContain('REVOKE UPDATE, DELETE, TRUNCATE');
    expect(sql).toContain('session_user');
    expect(sql).not.toContain("current_setting('app.actor_id'");
  });

  it('refuses destructive schema rollback past the audit safety barrier', () => {
    expect(() => migration.down()).toThrow('IRREVERSIBLE_AUDIT_SAFETY_BARRIER');
  });
});
