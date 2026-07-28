const { Client } = require('pg');

const DB = process.env.DATABASE_URL || 'postgres://vethelp:vethelp@postgres:5432/vethelp';
const fs = require('fs');

function canonical(row) {
  return [row.employee_id, row.role, row.clinic_id, row.location_id, String(row.active), row.revoked_at == null ? 'null' : 'set'].join('|');
}

async function main() {
  const client = new Client({ connectionString: DB });
  await client.connect();
  try {
    const result = await client.query(`
      SELECT
        membership.employee_id::text AS employee_id,
        membership.clinic_location_id::text AS location_id,
        location.clinic_id::text AS clinic_id,
        membership.role,
        membership.active,
        membership.revoked_at
      FROM clinic_schema.employee_location_memberships membership
      JOIN clinic_schema.clinic_locations location
        ON location.id = membership.clinic_location_id
      WHERE membership.employee_id::text LIKE '93000000-%'
      ORDER BY membership.employee_id, membership.clinic_location_id
    `);

    const seedPath = process.env.DEMO_SEED_JSON;
    if (!seedPath) throw new Error('DEMO_SEED_JSON is required');
    const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
    const locations = new Map(seed.clinic.locations.map((item) => [item.id, seed.clinic.id]));
    if (seed.foreignClinic?.locationId) locations.set(seed.foreignClinic.locationId, seed.foreignClinic.id);
    const expected = seed.employees.flatMap((profile) => profile.memberships.map(([role, locationId, active]) => canonical({
      employee_id: profile.employeeId, role, clinic_id: locations.get(locationId),
      location_id: locationId, active, revoked_at: active ? null : 'set',
    })));
    const actual = result.rows.map(canonical);
    const duplicates = actual.filter((value, index) => actual.indexOf(value) !== index);
    const missing = expected.filter((value) => !actual.includes(value));
    const unexpected = actual.filter((value) => !expected.includes(value));
    console.log(`[membership-check] expected=${expected.length} actual=${actual.length} missing=${missing.length} unexpected=${unexpected.length} duplicates=${duplicates.length}`);
    if (missing.length || unexpected.length || duplicates.length || actual.length !== expected.length) {
      throw new Error(`Authority matrix mismatch: missing=${missing.join(',') || '-'} unexpected=${unexpected.join(',') || '-'} duplicates=${duplicates.join(',') || '-'}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`[membership-check] FAILED: ${error.stack || error.message}`);
  process.exit(1);
});
