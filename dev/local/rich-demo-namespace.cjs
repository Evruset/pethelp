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

const demoHoldIds = `SELECT hold.id
  FROM booking_schema.booking_holds hold
  JOIN clinic_schema.appointment_slots slot ON slot.id = hold.slot_id
  LEFT JOIN clinic_schema.appointment_slots alternative ON alternative.id = hold.alternative_slot_id
  WHERE hold.id::text LIKE '97000000-%'
     OR slot.source = 'LOCAL_RICH_DEMO_V1'
     OR alternative.source = 'LOCAL_RICH_DEMO_V1'`;
const demoAppointmentIds = `SELECT appointment.id
  FROM booking_schema.appointments appointment
  JOIN clinic_schema.appointment_slots slot ON slot.id = appointment.slot_id
  WHERE appointment.id::text LIKE '98000000-%' OR slot.source = 'LOCAL_RICH_DEMO_V1'`;
const demoVisitIds = `SELECT visit.id FROM clinical_schema.visits visit WHERE visit.booking_hold_id IN (${demoHoldIds}) OR visit.appointment_id IN (${demoAppointmentIds})`;
const demoResultIds = `SELECT result.id FROM clinical_schema.visit_results result WHERE result.visit_id IN (${demoVisitIds})`;
const demoAmendmentIds = `SELECT amendment.id FROM clinical_schema.visit_result_amendments amendment WHERE amendment.visit_id IN (${demoVisitIds}) OR amendment.result_id IN (${demoResultIds})`;
const demoPaymentIntentIds = `SELECT intent.id FROM payment_schema.payment_intents intent WHERE intent.hold_id IN (${demoHoldIds})`;

const resetSql = Object.freeze({
  lockHolds: `SELECT hold.id FROM booking_schema.booking_holds hold WHERE hold.id IN (${demoHoldIds}) ORDER BY hold.id FOR UPDATE`,
  lockSlots: "SELECT id FROM clinic_schema.appointment_slots WHERE source='LOCAL_RICH_DEMO_V1' ORDER BY id FOR UPDATE",
  lockAppointments: `SELECT appointment.id FROM booking_schema.appointments appointment WHERE appointment.id IN (${demoAppointmentIds}) ORDER BY appointment.id FOR UPDATE`,
  lockOutbox: `SELECT event.id
    FROM booking_schema.outbox_events event
    WHERE event.aggregate_id IN (${demoHoldIds})
       OR event.aggregate_id IN (${demoAppointmentIds})
       OR event.id IN (
         SELECT notification.source_outbox_event_id
         FROM booking_schema.owner_notifications notification
         WHERE notification.booking_hold_id IN (${demoHoldIds})
       )
    FOR UPDATE`,
  notificationEmailDeliveries: `DELETE FROM booking_schema.owner_notification_email_deliveries delivery
    USING booking_schema.owner_notifications notification
    WHERE delivery.notification_id = notification.id
      AND notification.booking_hold_id IN (${demoHoldIds})`,
  ownerNotifications: `DELETE FROM booking_schema.owner_notifications WHERE booking_hold_id IN (${demoHoldIds})`,
  outbox: `DELETE FROM booking_schema.outbox_events WHERE aggregate_id IN (${demoHoldIds}) OR aggregate_id IN (${demoAppointmentIds})`,
  holdPriceSnapshots: `DELETE FROM booking_schema.hold_price_snapshots WHERE hold_id IN (${demoHoldIds})`,
  alternativeSwapGroups: `DELETE FROM booking_schema.alternative_swap_groups WHERE original_hold_id IN (${demoHoldIds})`,
  paymentLedgerEntries: `DELETE FROM payment_schema.ledger_entries WHERE payment_intent_id IN (${demoPaymentIntentIds})`,
  paymentWebhookEvents: `DELETE FROM payment_schema.provider_webhook_events WHERE payment_intent_id IN (${demoPaymentIntentIds})`,
  paymentIntents: `DELETE FROM payment_schema.payment_intents WHERE id IN (${demoPaymentIntentIds})`,
  telemedSessions: `DELETE FROM telemed_schema.telemed_sessions WHERE booking_hold_id IN (${demoHoldIds})`,
  diaryEntries: `DELETE FROM clinical_schema.diary_entries WHERE visit_id IN (${demoVisitIds}) OR source_result_id IN (${demoResultIds}) OR source_amendment_id IN (${demoAmendmentIds})`,
  visitResultAmendments: `DELETE FROM clinical_schema.visit_result_amendments WHERE id IN (${demoAmendmentIds})`,
  visitResults: `DELETE FROM clinical_schema.visit_results WHERE id IN (${demoResultIds})`,
  visits: `DELETE FROM clinical_schema.visits WHERE id IN (${demoVisitIds})`,
  associationEventReceipts: `DELETE FROM clinic_schema.clinic_patient_association_event_receipts WHERE source_aggregate_id IN (${demoAppointmentIds})`,
  associationRevisions: `DELETE FROM clinic_schema.clinic_patient_association_revisions WHERE source_appointment_id IN (${demoAppointmentIds})`,
  patientLocalProfiles: `DELETE FROM clinic_schema.clinic_patient_local_profiles profile
    USING clinic_schema.clinic_patient_associations association
    WHERE profile.clinic_id = association.clinic_id
      AND profile.clinic_location_id = association.clinic_location_id
      AND profile.patient_id = association.pet_id
      AND association.source_appointment_id IN (${demoAppointmentIds})`,
  patientAssociations: `DELETE FROM clinic_schema.clinic_patient_associations WHERE source_appointment_id IN (${demoAppointmentIds})`,
  events: `DELETE FROM booking_schema.appointment_events WHERE id::text LIKE '99000000-%' OR appointment_id IN (${demoAppointmentIds}) OR hold_id IN (${demoHoldIds})`,
  appointments: `DELETE FROM booking_schema.appointments WHERE id IN (${demoAppointmentIds})`,
  holds: `DELETE FROM booking_schema.booking_holds WHERE id IN (${demoHoldIds})`,
  slots: 'DELETE FROM clinic_schema.appointment_slots WHERE source=$1',
  memberships: 'DELETE FROM clinic_schema.employee_location_memberships WHERE employee_id = $1::uuid',
});

module.exports = { SOURCE, prefixes, uuid, owns, assertOwned, resetSql };
