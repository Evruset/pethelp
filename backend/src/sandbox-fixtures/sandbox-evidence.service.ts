import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { redactSensitiveData } from '../certification/redact-util';
import { CollectLatePaymentDto } from './dto/collect-late-payment.dto';
import { CollectMisTimeoutDto } from './dto/collect-mis-timeout.dto';

const ACTIVE_HOLD_STATES = [
  'MANUAL_CONFIRM_PENDING',
  'ALTERNATIVE_PENDING',
  'MIS_RESERVATION_PENDING',
  'MIS_RECONCILIATION_PENDING',
  'MIS_HELD',
  'PAYMENT_PENDING',
  'PAYMENT_IN_PROGRESS',
  'PAYMENT_RECONCILIATION_PENDING',
];

@Injectable()
export class SandboxEvidenceService {
  constructor(private readonly database: DatabaseService) {}

  async collectMisTimeout(input: CollectMisTimeoutDto) {
    const result = await this.database.query<{
      state: string;
      held_count: number;
      capacity: number;
      active_hold_count: number;
    }>(`
      SELECT h.state,
             s.held_count,
             s.capacity,
             COUNT(other_hold.id) FILTER (WHERE other_hold.state = ANY($2::text[]))::integer AS active_hold_count
      FROM booking_schema.booking_holds h
      JOIN clinic_schema.appointment_slots s ON s.id = h.slot_id
      LEFT JOIN booking_schema.booking_holds other_hold ON other_hold.slot_id = s.id
      WHERE h.id = $1::uuid
      GROUP BY h.state, s.held_count, s.capacity
    `, [input.holdId, ACTIVE_HOLD_STATES]);
    const row = result.rows[0];
    if (!row || row.state !== 'MIS_RECONCILIATION_PENDING' || row.held_count <= 0 || row.held_count !== row.active_hold_count || row.held_count > row.capacity) {
      throw new UnprocessableEntityException({
        code: 'SANDBOX_MIS_TIMEOUT_INVARIANT_FAILED',
        message: 'Hold state or local slot counters do not satisfy MIS timeout reconciliation invariants',
      });
    }

    const evidence = sanitize(input.rawHttpDump);
    await this.writeAudit('SANDBOX_MIS_TIMEOUT_EVIDENCE_COLLECTED', 'booking_hold', input.holdId, input.correlationId, {
      holdState: row.state,
      heldCount: row.held_count,
      activeHoldCount: row.active_hold_count,
      capacity: row.capacity,
      ...evidence,
    });
    return { verified: true, state: row.state, heldCount: row.held_count, activeHoldCount: row.active_hold_count, capacity: row.capacity };
  }

  async collectLatePayment(input: CollectLatePaymentDto) {
    const result = await this.database.query<{
      payment_status: string;
      hold_state: string;
      fenced_count: number;
    }>(`
      SELECT p.status AS payment_status,
             h.state AS hold_state,
             COUNT(l.id) FILTER (WHERE l.entry_type = 'FENCED')::integer AS fenced_count
      FROM payment_schema.payment_intents p
      JOIN booking_schema.booking_holds h ON h.id = p.hold_id
      LEFT JOIN payment_schema.ledger_entries l ON l.payment_intent_id = p.id
      WHERE p.id = $1::uuid
      GROUP BY p.status, h.state
    `, [input.paymentIntentId]);
    const row = result.rows[0];
    if (!row || row.payment_status !== 'VOIDED' || row.hold_state !== 'EXPIRED' || row.fenced_count < 1) {
      throw new UnprocessableEntityException({
        code: 'SANDBOX_LATE_PAYMENT_INVARIANT_FAILED',
        message: 'Late payment must leave an EXPIRED hold, a VOIDED intent and at least one FENCED ledger entry',
      });
    }

    const evidence = sanitize(input.rawHttpDump);
    await this.writeAudit('SANDBOX_LATE_PAYMENT_EVIDENCE_COLLECTED', 'payment_intent', input.paymentIntentId, input.correlationId, {
      paymentStatus: row.payment_status,
      holdState: row.hold_state,
      fencedLedgerEntries: row.fenced_count,
      ...evidence,
    });
    return { verified: true, paymentStatus: row.payment_status, holdState: row.hold_state, fencedLedgerEntries: row.fenced_count };
  }

  private async writeAudit(action: string, aggregateType: string, aggregateId: string, correlationId: string, payload: Record<string, unknown>): Promise<void> {
    await this.database.query(`
      INSERT INTO audit_schema.audit_log (actor_type, actor_id, action, aggregate_type, aggregate_id, correlation_id, payload_json)
      VALUES ('SYSTEM', 'sandbox-certification', $1, $2, $3::uuid, $4::uuid, $5::jsonb)
    `, [action, aggregateType, aggregateId, correlationId, JSON.stringify(payload)]);
  }
}

function sanitize(rawHttpDump: string): { rawHttpDumpSha256: string; redactedHttpDump: string } {
  const redacted = redactSensitiveData(rawHttpDump);
  return {
    rawHttpDumpSha256: createHash('sha256').update(rawHttpDump).digest('hex'),
    redactedHttpDump: redacted.slice(0, 8_192),
  };
}
