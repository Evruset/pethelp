import { Injectable } from '@nestjs/common';
import { JwtPayload, Role } from '../auth/auth.types';
import { DomainErrors } from '../common/domain-error';
import { DatabaseService } from '../database/database.service';
import { ClinicEmployeeAccessService } from './clinic-employee-access.service';

export interface HoldView {
  holdId: string;
  slotId: string;
  state: string;
  expiresAt: string;
  clinicLocationId: string;
  startsAt: string;
  endsAt: string;
}

@Injectable()
export class BookingHoldReadService {
  constructor(
    private readonly database: DatabaseService,
    private readonly clinicAccess: ClinicEmployeeAccessService,
  ) {}

  async readForActor(holdId: string, actor: JwtPayload): Promise<HoldView> {
    return this.database.withTransaction(async (client) => {
      await client.query("SET LOCAL lock_timeout = '50ms'");
      await client.query("SET LOCAL statement_timeout = '50ms'");
      const result = await client.query<{
        hold_id: string;
        owner_id: string;
        slot_id: string;
        state: string;
        expires_at: Date;
        clinic_location_id: string;
        starts_at: Date;
        ends_at: Date;
      }>(`
        SELECT h.id::text AS hold_id, h.owner_id::text, h.slot_id::text, h.state, h.expires_at,
               s.clinic_location_id::text, s.starts_at, s.ends_at
        FROM booking_schema.booking_holds h
        JOIN clinic_schema.appointment_slots s ON s.id = h.slot_id
        WHERE h.id = $1::uuid
        FOR SHARE OF h, s
      `, [holdId]);
      const hold = result.rows[0];
      if (!hold) throw DomainErrors.holdNotFound();

      if (actor.roles.includes(Role.OWNER)) {
        if (hold.owner_id !== actor.sub) throw DomainErrors.holdOwnerMismatch();
      } else if (!actor.roles.includes(Role.SYSTEM_WORKER)) {
        await this.clinicAccess.assertLocationAccess(client, actor, hold.clinic_location_id);
      }

      return {
        holdId: hold.hold_id,
        slotId: hold.slot_id,
        state: hold.state,
        expiresAt: hold.expires_at.toISOString(),
        clinicLocationId: hold.clinic_location_id,
        startsAt: hold.starts_at.toISOString(),
        endsAt: hold.ends_at.toISOString(),
      };
    });
  }
}
