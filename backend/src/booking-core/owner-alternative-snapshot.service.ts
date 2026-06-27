import { Injectable } from '@nestjs/common';
import { DomainErrors } from '../common/domain-error';
import { DatabaseService } from '../database/database.service';

export interface OwnerAlternativeSlotSnapshot {
  swapGroupId: string;
  holdId: string;
  state: 'ALTERNATIVE_PENDING';
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
      server_now: Date;
    }>(`
      SELECT
        h.id::text AS hold_id,
        h.state,
        h.version,
        h.slot_id::text AS original_slot_id,
        original_slot.starts_at AS original_starts_at,
        original_slot.ends_at AS original_ends_at,
        h.alternative_slot_id::text AS alternative_slot_id,
        swap.id::text AS swap_group_id,
        alternative_slot.starts_at AS alternative_starts_at,
        alternative_slot.ends_at AS alternative_ends_at,
        h.alternative_expires_at,
        clock_timestamp() AS server_now
      FROM booking_schema.booking_holds h
      JOIN clinic_schema.appointment_slots original_slot ON original_slot.id = h.slot_id
      JOIN clinic_schema.appointment_slots alternative_slot ON alternative_slot.id = h.alternative_slot_id
      JOIN booking_schema.alternative_swap_groups swap ON swap.original_hold_id = h.id
        AND swap.alternative_slot_id = h.alternative_slot_id
        AND swap.state = 'PENDING'
      WHERE h.id = $1::uuid
        AND h.owner_id = $2::uuid
        AND h.state = 'ALTERNATIVE_PENDING'
        AND h.alternative_expires_at > clock_timestamp()
    `, [holdId, ownerId]);

    const row = result.rows[0];
    if (!row) throw DomainErrors.holdNotFound();

    return {
      holdId: row.hold_id,
      swapGroupId: row.swap_group_id,
      state: 'ALTERNATIVE_PENDING',
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
    };
  }
}
