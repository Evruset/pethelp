import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AlternativeSlotService, AcceptedAlternativeSlot } from './alternative-slot.service';

@Injectable()
export class OwnerAlternativeAcceptanceService {
  constructor(
    private readonly alternatives: AlternativeSlotService,
    private readonly database: DatabaseService,
  ) {}

  async accept(holdId: string, ownerId: string): Promise<AcceptedAlternativeSlot> {
    try {
      return await this.alternatives.acceptAlternativeSlot(holdId, ownerId);
    } catch (error) {
      const replay = await this.database.query<{
        id: string;
        slot_id: string;
        state: string;
        owner_id: string;
      }>(`
        SELECT id::text, slot_id::text, state, owner_id::text
        FROM booking_schema.booking_holds
        WHERE id = $1::uuid
          AND owner_id = $2::uuid
      `, [holdId, ownerId]);
      const row = replay.rows[0];
      if (row?.state === 'MIS_HELD') {
        return {
          holdId: row.id,
          sourceSlotId: row.slot_id,
          slotId: row.slot_id,
          state: 'MIS_HELD',
        };
      }
      throw error;
    }
  }
}
