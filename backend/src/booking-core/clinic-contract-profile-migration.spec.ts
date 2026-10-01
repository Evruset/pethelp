/* eslint-disable @typescript-eslint/no-require-imports */

describe('clinic booking contract profile migration', () => {
  const migration = require('../../migrations/node-pg/1719630000000_add_clinic_booking_contract_profile.js');

  it('adds a manual-default, constrained, versioned and audited clinic policy', () => {
    const pgm = { sql: jest.fn() };
    migration.up(pgm);
    const sql = pgm.sql.mock.calls[0][0] as string;
    expect(sql).toContain("booking_contract_profile text NOT NULL DEFAULT 'MVP_V1_MANUAL'");
    expect(sql).toContain("'MVP_V1_MANUAL', 'V15_AUTO_CONFIRM'");
    expect(sql).toContain('booking_contract_profile_version integer NOT NULL DEFAULT 1');
    expect(sql).toContain('booking_contract_profile_history');
    expect(sql).toContain('clinics_prepare_booking_contract_profile_change');
    expect(sql).not.toMatch(/DELETE FROM|TRUNCATE/i);
  });

  it('provides a bounded schema rollback without mutating booking history', () => {
    const pgm = { sql: jest.fn() };
    migration.down(pgm);
    const sql = pgm.sql.mock.calls[0][0] as string;
    expect(sql).toContain('DROP COLUMN booking_contract_profile');
    expect(sql).not.toMatch(/booking_schema\.booking_holds|booking_schema\.appointments/);
  });
});
