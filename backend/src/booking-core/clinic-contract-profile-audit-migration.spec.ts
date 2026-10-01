/* eslint-disable @typescript-eslint/no-require-imports */

describe('clinic booking contract profile audit hardening migration', () => {
  const migration = require('../../migrations/node-pg/1719640000000_harden_clinic_booking_contract_profile_audit.js');

  it('creates a forward-only audit archive with trusted change metadata', () => {
    const pgm = { sql: jest.fn() };
    migration.up(pgm);
    const sql = pgm.sql.mock.calls[0][0] as string;
    expect(sql).toContain('audit_schema.clinic_booking_contract_profile_audit');
    expect(sql).toContain("current_setting('app.actor_id', true)");
    expect(sql).toContain("current_setting('app.change_reference', true)");
    expect(migration.down()).toBeUndefined();
  });
});
