import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { JwtPayload } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import { ClinicEmployeeAccessService } from './clinic-employee-access.service';

interface ManualConfirmationQueueRow {
  hold_id: string;
  hold_version: number;
  hold_expires_at: Date;
  manual_confirm_pending_at: Date;
  confirmation_sla_expires_at: Date;
  slot_id: string;
  slot_starts_at: Date;
  slot_ends_at: Date;
  pet_id: string;
  pet_name: string;
  pet_species: string;
  service_name: string | null;
}

export interface ManualConfirmationQueueItem {
  holdId: string;
  version: number;
  holdExpiresAt: string;
  manualConfirmPendingAt: string;
  confirmationSlaExpiresAt: string;
  slot: {
    id: string;
    startsAt: string;
    endsAt: string;
  };
  pet: {
    id: string;
    name: string;
    species: string;
  };
  service: {
    displayName: string;
  } | null;
}

export interface ManualConfirmationQueueResult {
  locationId: string;
  serverNow: string;
  items: ManualConfirmationQueueItem[];
}

/**
 * Read model for the Level-C clinic portal queue. The service deliberately
 * performs the same DB-backed location access check as command handlers: JWT
 * locationIds are an early boundary, while the active membership is the
 * authoritative source.
 */
@Injectable()
export class ClinicQueueService {
  constructor(
    private readonly database: DatabaseService,
    private readonly clinicAccess: ClinicEmployeeAccessService,
  ) {}

  async listManualConfirmationQueue(input: {
    locationId: string;
    employee: JwtPayload;
    limit: number;
  }): Promise<ManualConfirmationQueueResult> {
    return this.database.withTransaction(async (client) => {
      await this.setReadTransactionLimits(client);
      await this.clinicAccess.assertLocationAccess(client, input.employee, input.locationId);

      const serverNow = await this.dbNow(client);
      const result = await client.query<ManualConfirmationQueueRow>(`
        SELECT
          h.id AS hold_id,
          h.version AS hold_version,
          h.expires_at AS hold_expires_at,
          h.state_changed_at AS manual_confirm_pending_at,
          h.confirmation_sla_expires_at,
          s.id AS slot_id,
          s.starts_at AS slot_starts_at,
          s.ends_at AS slot_ends_at,
          p.id AS pet_id,
          p.name AS pet_name,
          p.species AS pet_species,
          cs.display_name AS service_name
        FROM booking_schema.booking_holds h
        JOIN clinic_schema.appointment_slots s ON s.id = h.slot_id
        JOIN pet_schema.pets p ON p.id = h.pet_id
        LEFT JOIN clinic_schema.clinic_services cs ON cs.id = s.service_id
        WHERE s.clinic_location_id = $1::uuid
          AND h.state = 'MANUAL_CONFIRM_PENDING'
          AND h.confirmation_sla_expires_at IS NOT NULL
        ORDER BY h.state_changed_at ASC, h.id ASC
        LIMIT $2
      `, [input.locationId, input.limit]);

      return {
        locationId: input.locationId,
        serverNow: serverNow.toISOString(),
        items: result.rows.map((row) => this.toItem(row)),
      };
    });
  }

  private toItem(row: ManualConfirmationQueueRow): ManualConfirmationQueueItem {
    return {
      holdId: row.hold_id,
      version: row.hold_version,
      holdExpiresAt: row.hold_expires_at.toISOString(),
      manualConfirmPendingAt: row.manual_confirm_pending_at.toISOString(),
      confirmationSlaExpiresAt: row.confirmation_sla_expires_at.toISOString(),
      slot: {
        id: row.slot_id,
        startsAt: row.slot_starts_at.toISOString(),
        endsAt: row.slot_ends_at.toISOString(),
      },
      pet: {
        id: row.pet_id,
        name: row.pet_name,
        species: row.pet_species,
      },
      service: row.service_name ? { displayName: row.service_name } : null,
    };
  }

  private async dbNow(client: PoolClient): Promise<Date> {
    const result = await client.query<{ now: Date }>('SELECT clock_timestamp() AS now');
    return result.rows[0].now;
  }

  private async setReadTransactionLimits(client: PoolClient): Promise<void> {
    await client.query("SET LOCAL statement_timeout = '250ms'");
  }
}
