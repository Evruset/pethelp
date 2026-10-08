import { randomUUID } from 'node:crypto';

/** A parent reset must not reuse the identity retained by append-only audit. */
export function renewRegressionClinicIds(
  ids: { clinic: string; otherClinic: string },
  databaseUrl: string,
): void {
  let target: URL;
  try {
    target = new URL(databaseUrl);
  } catch {
    throw new Error('REGRESSION_FIXTURE_DATABASE_NOT_OWNED');
  }
  if (
    process.env.NODE_ENV !== 'test' ||
    process.env.WAVE4_ACCEPTANCE !== 'true' ||
    !['postgres:', 'postgresql:'].includes(target.protocol) ||
    target.hostname !== 'postgres' ||
    !/^\/vethelp_wave3_reconcile_[a-z0-9_]+$/.test(target.pathname)
  ) {
    throw new Error('REGRESSION_FIXTURE_DATABASE_NOT_OWNED');
  }

  // Only this fixture's new clinic incarnations change. Audit is never cleared.
  ids.clinic = randomUUID();
  ids.otherClinic = randomUUID();
}
