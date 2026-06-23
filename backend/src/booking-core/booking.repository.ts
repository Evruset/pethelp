import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { HoldRow, SlotRow } from './booking.types';

@Injectable()
export class BookingRepository {
  async lockSlot(client: PoolClient, slotId: string): Promise<SlotRow | undefined> {
    const result = await client.query<SlotRow>(`
      SELECT id, clinic_location_id, starts_at, ends_at, capacity, booked_count, held_count,
             state, status, integration_mode, last_freshness_sync, version
      FROM clinic_schema.appointment_slots
      WHERE id = $1
      FOR UPDATE
    `, [slotId]);
    return result.rows[0];
  }

  async lockHold(client: PoolClient, holdId: string): Promise<HoldRow | undefined> {
    const result = await client.query<HoldRow>(`
      SELECT id, slot_id, owner_id, pet_id, state, expires_at,
             confirmation_sla_expires_at, alternative_slot_id, alternative_expires_at,
             state_changed_at, version, created_at
      FROM booking_schema.booking_holds
      WHERE id = $1
      FOR UPDATE
    `, [holdId]);
    return result.rows[0];
  }

  async now(client: PoolClient): Promise<Date> {
    const result = await client.query<{ now: Date }>('SELECT clock_timestamp() AS now');
    return result.rows[0].now;
  }
}
