import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AlternativeSlotService, AcceptedAlternativeSlot } from './alternative-slot.service';

@Injectable()
export class OwnerAlternativeAcceptanceService {
  constructor(
    private readonly alternatives: AlternativeSlotService,
    private readonly database: DatabaseService,
  ) {}

  async accept(holdId: string, ownerId: string, command: { expectedVersion: number; idempotencyKey: string }): Promise<AcceptedAlternativeSlot> {
    try {
      return await this.alternatives.acceptAlternativeSlot(holdId, ownerId, command);
    } catch (error) {
      const replay = await this.database.query<{
        id: string;
        slot_id: string;
        state: string;
        owner_id: string;
        swap_group_id: string | null;
        original_slot_id: string | null;
      }>(`
        SELECT h.id::text, h.slot_id::text, h.state, h.owner_id::text,
               swap.id::text AS swap_group_id,
               swap.original_slot_id::text AS original_slot_id
        FROM booking_schema.booking_holds
        LEFT JOIN LATERAL (
          SELECT id
          FROM booking_schema.alternative_swap_groups
          WHERE original_hold_id = h.id
            AND state = 'ACCEPTED'
          ORDER BY updated_at DESC
          LIMIT 1
        ) swap ON true
        WHERE h.id = $1::uuid
          AND h.owner_id = $2::uuid
      `, [holdId, ownerId]);
      const row = replay.rows[0];
      if (row?.state === 'MIS_HELD') {
        return {
          swapGroupId: row.swap_group_id ?? row.id,
          holdId: row.id,
          sourceSlotId: row.original_slot_id ?? row.slot_id,
          slotId: row.slot_id,
          state: 'MIS_HELD',
        };
      }
      throw error;
    }
  }
}
