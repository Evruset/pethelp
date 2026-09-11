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

    const doctorResult = await client.query(`
      SELECT doctor.id::text AS doctor_id, staff.id::text AS staff_id,
             doctor.full_name, staff.display_name,
             doctor.clinic_location_id::text AS doctor_location_id,
             staff.clinic_location_id::text AS staff_location_id,
             membership.role AS membership_role, membership.active AS membership_active,
             membership.revoked_at
      FROM catalog_schema.doctors doctor
      LEFT JOIN clinic_schema.clinic_staff staff ON staff.id = doctor.id
      LEFT JOIN clinic_schema.employee_location_memberships membership
        ON membership.employee_id = staff.id
       AND membership.clinic_location_id = staff.clinic_location_id
      WHERE doctor.id::text LIKE '92500000-%'
      ORDER BY doctor.id
    `);
    const expectedDoctors = seed.doctors.map((doctor) => [
      doctor.id, doctor.staffId, doctor.fullName, doctor.fullName,
      doctor.locationId, doctor.locationId, 'CLINIC_VETERINARIAN', true, null,
    ]);
    const actualDoctors = doctorResult.rows.map((row) => [
      row.doctor_id, row.staff_id, row.full_name, row.display_name,
      row.doctor_location_id, row.staff_location_id, row.membership_role,
      row.membership_active, row.revoked_at,
    ]);
    if (JSON.stringify(actualDoctors) !== JSON.stringify(expectedDoctors)) {
      throw new Error('Rich-demo catalog doctor, staff, and veterinarian membership mapping mismatch.');
    }

    const slotResult = await client.query(`
      SELECT
        count(*) FILTER (WHERE slot.state='OPEN' AND slot.starts_at>clock_timestamp() AND slot.doctor_id IS NOT NULL)::int AS future_doctor_slots,
        count(*) FILTER (WHERE slot.state='OPEN' AND slot.starts_at>clock_timestamp() AND slot.staff_id IS NOT NULL)::int AS future_staff_slots,
        count(*) FILTER (WHERE slot.doctor_id IS NOT NULL AND (
          slot.staff_id IS NULL OR slot.staff_id<>slot.doctor_id OR staff.id IS NULL
          OR staff.active IS NOT TRUE OR staff.role<>'VETERINARIAN'
          OR staff.clinic_location_id<>slot.clinic_location_id
        ))::int AS incompatible_slots,
        count(*) FILTER (WHERE slot.doctor_id IS NOT NULL AND doctor.id IS NULL)::int AS missing_catalog_doctors
      FROM clinic_schema.appointment_slots slot
      LEFT JOIN clinic_schema.clinic_staff staff ON staff.id=slot.staff_id
      LEFT JOIN catalog_schema.doctors doctor ON doctor.id=slot.doctor_id
      WHERE slot.source='LOCAL_RICH_DEMO_V1'
    `);
    const slotCounts = slotResult.rows[0];
    console.log(`[doctor-check] mapped=${actualDoctors.length} futureDoctorSlots=${slotCounts.future_doctor_slots} futureStaffSlots=${slotCounts.future_staff_slots} incompatibleSlots=${slotCounts.incompatible_slots} missingCatalogDoctors=${slotCounts.missing_catalog_doctors}`);
    if (actualDoctors.length !== 8 || slotCounts.future_doctor_slots < 1 ||
        slotCounts.future_staff_slots !== slotCounts.future_doctor_slots ||
        slotCounts.incompatible_slots !== 0 || slotCounts.missing_catalog_doctors !== 0) {
      throw new Error('Rich-demo doctor/slot compatibility invariant failed.');
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`[membership-check] FAILED: ${error.stack || error.message}`);
  process.exit(1);
});
