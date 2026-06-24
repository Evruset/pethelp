import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';

export interface MisTimeoutFixture {
  holdId: string;
  correlationId: string;
}

export interface LatePaymentFixture {
  paymentIntentId: string;
  idempotencyKey: string;
  providerEventId: string;
  providerPaymentId: string;
  rawWebhook: string;
  correlationId: string;
}

@Injectable()
export class SandboxScenarioFixtureService {
  constructor(private readonly database: DatabaseService) {}

  /**
   * Creates an isolated MIS_RESERVATION_PENDING hold and queues the same
   * durable event consumed by MisOutboxRelayWorker in regular operation.
   */
  async prepareMisTimeout(correlationId: string): Promise<MisTimeoutFixture> {
    const fixture = await this.createBookingFixture('MIS_RESERVATION_PENDING');
    await this.database.withTransaction(async (client) => {
      await client.query(`
        INSERT INTO booking_schema.outbox_events (
          event_type, correlation_id, aggregate_type, aggregate_id,
          aggregate_version, payload_json, deduplication_key
        ) VALUES (
          'mis.reservation.requested.v1', $1::uuid, 'booking_hold', $2::uuid,
          1, $3::jsonb, $4
        )
      `, [
        correlationId,
        fixture.holdId,
        JSON.stringify({
          holdId: fixture.holdId,
          slotId: fixture.slotId,
          clinicId: fixture.clinicId,
          externalPatientId: fixture.externalPatientId,
          correlationId,
        }),
        `sandbox-mis-timeout:${fixture.holdId}`,
      ]);
      await this.audit(client, 'SANDBOX_MIS_TIMEOUT_FIXTURE_PREPARED', fixture.holdId, correlationId, {
        slotId: fixture.slotId,
        clinicId: fixture.clinicId,
      });
    });
    return { holdId: fixture.holdId, correlationId };
  }

  /**
   * Creates an EXPIRED hold and a ready provider payment intent. The test then
   * submits a signed webhook through the public payment controller, which
   * performs the actual fencing and schedules the actual provider void.
   */
  async prepareLatePayment(correlationId: string): Promise<LatePaymentFixture> {
    const fixture = await this.createBookingFixture('EXPIRED');
    const paymentIntentId = randomUUID();
    const idempotencyKey = randomUUID();
    const providerEventId = `sandbox-authorized-${randomUUID()}`;
    const providerPaymentId = `sandbox-payment-${randomUUID()}`;
    const rawWebhook = JSON.stringify({ idempotencyKey, eventId: providerEventId, providerPaymentId });

    await this.database.withTransaction(async (client) => {
      await client.query(`
        INSERT INTO payment_schema.payment_intents (
          id, hold_id, hold_version, amount, currency, status,
          idempotency_key, provider_payment_id, correlation_id
        ) VALUES (
          $1::uuid, $2::uuid, 1, 1000.00::numeric, 'RUB', 'CREATED',
          $3::uuid, $4, $5::uuid
        )
      `, [paymentIntentId, fixture.holdId, idempotencyKey, providerPaymentId, correlationId]);
      await client.query(`
        INSERT INTO payment_schema.ledger_entries (
          payment_intent_id, entry_type, amount, currency, idempotency_key, payload_json
        ) VALUES ($1::uuid, 'INTENT_CREATED', 1000.00::numeric, 'RUB', $2, $3::jsonb)
      `, [paymentIntentId, `sandbox-intent-created:${paymentIntentId}`, JSON.stringify({ holdId: fixture.holdId })]);
      await this.audit(client, 'SANDBOX_LATE_PAYMENT_FIXTURE_PREPARED', paymentIntentId, correlationId, {
        holdId: fixture.holdId,
        providerPaymentId,
      }, 'payment_intent');
    });

    return { paymentIntentId, idempotencyKey, providerEventId, providerPaymentId, rawWebhook, correlationId };
  }

  async readSlotInvariant(holdId: string) {
    const result = await this.database.query<{
      state: string;
      held_count: number;
      active_hold_count: number;
      capacity: number;
    }>(`
      SELECT h.state,
             s.held_count,
             COUNT(active.id) FILTER (WHERE active.state = ANY($2::text[]))::integer AS active_hold_count,
             s.capacity
      FROM booking_schema.booking_holds h
      JOIN clinic_schema.appointment_slots s ON s.id = h.slot_id
      LEFT JOIN booking_schema.booking_holds active ON active.slot_id = s.id
      WHERE h.id = $1::uuid
      GROUP BY h.state, s.held_count, s.capacity
    `, [holdId, activeStates]);
    const row = result.rows[0];
    if (!row) return undefined;
    return {
      state: row.state,
      slot: { heldCount: row.held_count, activeHoldCount: row.active_hold_count, capacity: row.capacity },
    };
  }

  async readLedger(paymentIntentId: string) {
    const result = await this.database.query<{ entry_type: string }>(`
      SELECT entry_type
      FROM payment_schema.ledger_entries
      WHERE payment_intent_id = $1::uuid
      ORDER BY created_at, id
    `, [paymentIntentId]);
    return { entries: result.rows.map((row) => ({ entryType: row.entry_type })) };
  }

  private async createBookingFixture(state: 'MIS_RESERVATION_PENDING' | 'EXPIRED') {
    const ownerId = randomUUID();
    const petId = randomUUID();
    const clinicId = randomUUID();
    const locationId = randomUUID();
    const serviceId = randomUUID();
    const slotId = randomUUID();
    const holdId = randomUUID();
    const externalPatientId = `sandbox-patient-${randomUUID()}`;
    const heldCount = state === 'EXPIRED' ? 0 : 1;

    await this.database.withTransaction(async (client) => {
      await client.query('INSERT INTO identity_schema.users (id) VALUES ($1::uuid)', [ownerId]);
      await client.query(`
        INSERT INTO pet_schema.pets (id, owner_id, name, species, external_patient_id)
        VALUES ($1::uuid, $2::uuid, 'Sandbox Pet', 'DOG', $3)
      `, [petId, ownerId, externalPatientId]);
      await client.query(`
        INSERT INTO clinic_schema.clinics (id, legal_name, public_name, mis_type)
        VALUES ($1::uuid, 'Sandbox Clinic LLC', 'Sandbox Clinic', 'VET_MANAGER_API')
      `, [clinicId]);
      await client.query(`
        INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address)
        VALUES ($1::uuid, $2::uuid, 'Sandbox address')
      `, [locationId, clinicId]);
      await client.query(`
        INSERT INTO clinic_schema.clinic_services (id, clinic_location_id, code, display_name, duration_minutes)
        VALUES ($1::uuid, $2::uuid, 'SANDBOX_VISIT', 'Sandbox visit', 30)
      `, [serviceId, locationId]);
      await client.query(`
        INSERT INTO clinic_schema.appointment_slots (
          id, clinic_location_id, service_id, starts_at, ends_at, capacity, held_count
        ) VALUES (
          $1::uuid, $2::uuid, $3::uuid,
          clock_timestamp() + interval '2 hours', clock_timestamp() + interval '150 minutes', 1, $4
        )
      `, [slotId, locationId, serviceId, heldCount]);
      await client.query(`
        INSERT INTO booking_schema.booking_holds (id, slot_id, owner_id, pet_id, state, expires_at)
        VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, clock_timestamp() + interval '15 minutes')
      `, [holdId, slotId, ownerId, petId, state]);
    });

    return { ownerId, petId, clinicId, locationId, serviceId, slotId, holdId, externalPatientId };
  }

  private async audit(
    client: { query: DatabaseService['query'] },
    action: string,
    aggregateId: string,
    correlationId: string,
    payload: Record<string, unknown>,
    aggregateType = 'booking_hold',
  ): Promise<void> {
    await client.query(`
      INSERT INTO audit_schema.audit_log (actor_type, actor_id, action, aggregate_type, aggregate_id, correlation_id, payload_json)
      VALUES ('SYSTEM', 'sandbox-certification', $1, $2, $3::uuid, $4::uuid, $5::jsonb)
    `, [action, aggregateType, aggregateId, correlationId, JSON.stringify(payload)]);
  }
}

const activeStates = [
  'MANUAL_CONFIRM_PENDING', 'ALTERNATIVE_PENDING', 'MIS_RESERVATION_PENDING',
  'MIS_RECONCILIATION_PENDING', 'MIS_HELD', 'PAYMENT_PENDING',
  'PAYMENT_IN_PROGRESS', 'PAYMENT_RECONCILIATION_PENDING',
];
