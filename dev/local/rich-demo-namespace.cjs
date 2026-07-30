const SOURCE = 'LOCAL_RICH_DEMO_V1';

const prefixes = Object.freeze({
  clinic: '90',
  location: '91',
  service: '92',
  doctor: '925',
  employee: '93',
  owner: '94',
  pet: '95',
  slot: '96',
  hold: '97',
  appointment: '98',
  event: '99',
});

function uuid(prefix, sequence) {
  if (!Object.values(prefixes).includes(prefix)) {
    throw new Error(`Unreserved rich-demo prefix: ${prefix}`);
  }
  if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > 999999999999) {
    throw new Error(`Invalid rich-demo sequence: ${sequence}`);
  }
  return `${(prefix + '00000000').slice(0, 8)}-0000-4000-8000-${String(sequence).padStart(12, '0')}`;
}

function owns(kind, id) {
  const prefix = prefixes[kind];
  return typeof id === 'string' &&
    typeof prefix === 'string' &&
    id.startsWith((prefix + '00000000').slice(0, 8));
}

function assertOwned(kind, id) {
  if (!owns(kind, id)) throw new Error(`Rich-demo ${kind} ID is outside its reserved namespace.`);
  return id;
}

const resetSql = Object.freeze({
  events: "DELETE FROM booking_schema.appointment_events WHERE id::text LIKE '99000000-%' OR appointment_id::text LIKE '98000000-%' OR hold_id::text LIKE '97000000-%'",
  appointments: "DELETE FROM booking_schema.appointments WHERE id::text LIKE '98000000-%'",
  holds: "DELETE FROM booking_schema.booking_holds WHERE id::text LIKE '97000000-%'",
  slots: 'DELETE FROM clinic_schema.appointment_slots WHERE source=$1',
  memberships: 'DELETE FROM clinic_schema.employee_location_memberships WHERE employee_id = $1::uuid',
});

module.exports = { SOURCE, prefixes, uuid, owns, assertOwned, resetSql };
