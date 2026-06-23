import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DomainErrors } from '../common/domain-error';
import { DatabaseService } from '../database/database.service';

export interface ManualConfirmationSlaResult {
  holdId: string;
  confirmationSlaExpiresAt: string;
}

interface LockedManualHold {
  id: string;
  state: string;
  integration_mode: 'LEVEL_A' | 'LEVEL_B' | 'LEVEL_C';
}

/**
 * Owns Level-C manual-confirmation SLA metadata. All eligibility and deadline
 * decisions use PostgreSQL clock_timestamp(), never application-node time.
 */
@Injectable()
export class ClinicPortalService {
  constructor(private readonly database: DatabaseService) {}

  async initiateManualConfirmationSla(holdId: string): Promise<ManualConfirmationSlaResult> {
    return this.database.withTransaction(async (client) => {
      await this.setShortTransactionLimits(client);
      const locked = await client.query<LockedManualHold>(`
        SELECT h.id, h.state, s.integration_mode
        FROM booking_schema.booking_holds h
        JOIN clinic_schema.appointment_slots s ON s.id = h.slot_id
        WHERE h.id = $1::uuid
        FOR UPDATE OF h, s
      `, [holdId]);
      const hold = locked.rows[0];
      if (!hold) throw DomainErrors.holdNotFound();
      if (hold.state !== 'MANUAL_CONFIRM_PENDING' || hold.integration_mode !== 'LEVEL_C') {
        throw DomainErrors.invalidTransition();
      }

      return this.initiateManualConfirmationSlaInTransaction(client, holdId);
    });
  }

  /**
   * Used when the hold has already been created inside the caller's short
   * transaction. The caller must own the hold row lock or have just inserted it.
   */
  async initiateManualConfirmationSlaInTransaction(
    client: PoolClient,
    holdId: string,
  ): Promise<ManualConfirmationSlaResult> {
    const result = await client.query<{ id: string; confirmation_sla_expires_at: Date }>(`
      UPDATE booking_schema.booking_holds
      SET confirmation_sla_expires_at = clock_timestamp() + interval '15 minutes',
          updated_at = clock_timestamp()
      WHERE id = $1::uuid
        AND state = 'MANUAL_CONFIRM_PENDING'
      RETURNING id, confirmation_sla_expires_at
    `, [holdId]);

    if (!result.rows[0]) throw DomainErrors.invalidTransition();
    return {
      holdId: result.rows[0].id,
      confirmationSlaExpiresAt: result.rows[0].confirmation_sla_expires_at.toISOString(),
    };
  }

  private async setShortTransactionLimits(client: PoolClient): Promise<void> {
    await client.query("SET LOCAL lock_timeout = '50ms'");
    await client.query("SET LOCAL statement_timeout = '50ms'");
  }
}
