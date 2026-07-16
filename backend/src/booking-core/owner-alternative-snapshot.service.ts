import { Injectable } from '@nestjs/common';
import { DomainErrors } from '../common/domain-error';
import { DatabaseService } from '../database/database.service';

export interface OwnerAlternativeSlotSnapshot {
  proposalId: string;
  bookingId: string;
  swapGroupId: string;
  holdId: string;
  state: 'ALTERNATIVE_PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'SUPERSEDED';
  version: number;
  serverNow: string;
  originalSlot: {
    id: string;
    startsAt: string;
    endsAt: string;
  };
  alternativeSlot: {
    id: string;
    startsAt: string;
    endsAt: string;
  };
  expiresAt: string;
  deadline: string;
  aggregateVersion: number;
  proposedSlot: OwnerAlternativeSlotSnapshot['alternativeSlot'];
  actions: { canAccept: boolean; canDecline: boolean; code: string };
  priceCopy: string;
}

@Injectable()
export class OwnerAlternativeSnapshotService {
  constructor(private readonly database: DatabaseService) {}

  async read(holdId: string, ownerId: string): Promise<OwnerAlternativeSlotSnapshot> {
    const result = await this.database.query<{
      hold_id: string;
      state: string;
      version: number;
      original_slot_id: string;
      original_starts_at: Date;
      original_ends_at: Date;
      alternative_slot_id: string;
      swap_group_id: string;
      alternative_starts_at: Date;
      alternative_ends_at: Date;
      alternative_expires_at: Date;
      proposal_state: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'REPLACED';
      server_now: Date;
    }>(`
      SELECT
        h.id::text AS hold_id,
        h.state,
        h.version,
        swap.original_slot_id::text AS original_slot_id,
        original_slot.starts_at AS original_starts_at,
        original_slot.ends_at AS original_ends_at,
        swap.alternative_slot_id::text AS alternative_slot_id,
        swap.id::text AS swap_group_id,
        alternative_slot.starts_at AS alternative_starts_at,
        alternative_slot.ends_at AS alternative_ends_at,
        swap.expires_at AS alternative_expires_at,
        swap.state AS proposal_state,
        clock_timestamp() AS server_now
      FROM booking_schema.booking_holds h
      JOIN LATERAL (
        SELECT candidate.* FROM booking_schema.alternative_swap_groups candidate
        WHERE candidate.original_hold_id=h.id
        ORDER BY candidate.updated_at DESC LIMIT 1
      ) swap ON true
      JOIN clinic_schema.appointment_slots original_slot ON original_slot.id = swap.original_slot_id
      JOIN clinic_schema.appointment_slots alternative_slot ON alternative_slot.id = swap.alternative_slot_id
      WHERE h.id = $1::uuid
        AND h.owner_id = $2::uuid
    `, [holdId, ownerId]);

    const row = result.rows[0];
    if (!row) throw DomainErrors.holdNotFound();

    return {
      bookingId: row.hold_id,
      proposalId: row.swap_group_id,
      holdId: row.hold_id,
      swapGroupId: row.swap_group_id,
      state: row.proposal_state === 'PENDING'
          ? 'ALTERNATIVE_PENDING'
          : row.proposal_state === 'REPLACED'
            ? 'SUPERSEDED'
            : row.proposal_state,
      version: row.version,
      serverNow: row.server_now.toISOString(),
      originalSlot: {
        id: row.original_slot_id,
        startsAt: row.original_starts_at.toISOString(),
        endsAt: row.original_ends_at.toISOString(),
      },
      alternativeSlot: {
        id: row.alternative_slot_id,
        startsAt: row.alternative_starts_at.toISOString(),
        endsAt: row.alternative_ends_at.toISOString(),
      },
      expiresAt: row.alternative_expires_at.toISOString(),
      deadline: row.alternative_expires_at.toISOString(),
      aggregateVersion: row.version,
      proposedSlot: {
        id: row.alternative_slot_id,
        startsAt: row.alternative_starts_at.toISOString(),
        endsAt: row.alternative_ends_at.toISOString(),
      },
      actions: {
        canAccept: row.proposal_state === 'PENDING' && row.alternative_expires_at > row.server_now,
        canDecline: row.proposal_state === 'PENDING' && row.alternative_expires_at > row.server_now,
        code: row.proposal_state === 'PENDING'
          ? 'ALTERNATIVE_RESOLUTION_REQUIRED'
          : `ALTERNATIVE_${row.proposal_state}`,
      },
      priceCopy: 'Окончательная стоимость подтверждается клиникой.',
    };
  }
}
