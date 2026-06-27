import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { JwtPayload } from '../auth/auth.types';
import { DomainErrors } from '../common/domain-error';
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
  latest_audit_action: string | null;
  latest_audit_at: Date | null;
  latest_audit_actor_type: string | null;
}

interface HoldAuditTrailRow {
  id: string;
  occurred_at: Date;
  actor_type: string;
  actor_id: string | null;
  action: string;
  correlation_id: string | null;
  payload_json: Record<string, unknown>;
}

export interface ManualConfirmationQueueItem {
  holdId: string;
  version: number;
  holdExpiresAt: string;
  manualConfirmPendingAt: string;
  confirmationSlaExpiresAt: string;
  slot: { id: string; startsAt: string; endsAt: string };
  pet: { id: string; name: string; species: string };
  service: { displayName: string } | null;
  latestAudit: {
    action: string;
    occurredAt: string;
    actorType: string;
  } | null;
}

export interface ManualConfirmationQueueResult {
  clinicId: string;
  locationId: string;
  serverNow: string;
  items: ManualConfirmationQueueItem[];
}

export interface HoldAuditTrailItem {
  id: string;
  occurredAt: string;
  actorType: string;
  actorId: string | null;
  action: string;
  correlationId: string | null;
  payload: Record<string, unknown>;
}

export interface HoldAuditTrailResult {
  holdId: string;
  clinicId: string;
  locationId: string;
  serverNow: string;
  items: HoldAuditTrailItem[];
}

@Injectable()
export class ClinicQueueService {
  constructor(
    private readonly database: DatabaseService,
    private readonly clinicAccess: ClinicEmployeeAccessService,
  ) {}

  async listManualConfirmationQueue(input: {
    clinicId: string;
    locationId: string;
    employee: JwtPayload;
    limit: number;
  }): Promise<ManualConfirmationQueueResult> {
    return this.database.withTransaction(async (client) => {
      await client.query("SET LOCAL statement_timeout = '250ms'");
      if (!input.employee.clinicIds?.includes(input.clinicId)) {
        throw DomainErrors.clinicScopeMismatch();
      }
      await this.clinicAccess.assertLocationAccess(client, input.employee, input.locationId);
      await this.assertLocationBelongsToClinic(client, input.clinicId, input.locationId);

      const serverNow = await this.dbNow(client);
      const result = await client.query<ManualConfirmationQueueRow>(`
        SELECT h.id AS hold_id, h.version AS hold_version,
               h.expires_at AS hold_expires_at,
               h.state_changed_at AS manual_confirm_pending_at,
               h.confirmation_sla_expires_at,
               s.id AS slot_id, s.starts_at AS slot_starts_at, s.ends_at AS slot_ends_at,
               p.id AS pet_id, p.name AS pet_name, p.species AS pet_species,
               cs.display_name AS service_name,
               audit.action AS latest_audit_action,
               audit.occurred_at AS latest_audit_at,
               audit.actor_type AS latest_audit_actor_type
        FROM booking_schema.booking_holds h
        JOIN clinic_schema.appointment_slots s ON s.id = h.slot_id
        JOIN pet_schema.pets p ON p.id = h.pet_id
        LEFT JOIN clinic_schema.clinic_services cs ON cs.id = s.service_id
        LEFT JOIN LATERAL (
          SELECT action, occurred_at, actor_type
          FROM audit_schema.audit_log
          WHERE aggregate_type = 'booking_hold'
            AND aggregate_id = h.id
          ORDER BY occurred_at DESC
          LIMIT 1
        ) audit ON true
        WHERE s.clinic_location_id = $1::uuid
          AND h.state = 'MANUAL_CONFIRM_PENDING'
          AND h.confirmation_sla_expires_at IS NOT NULL
        ORDER BY h.state_changed_at ASC, h.id ASC
        LIMIT $2
      `, [input.locationId, input.limit]);

      return {
        clinicId: input.clinicId,
        locationId: input.locationId,
        serverNow: serverNow.toISOString(),
        items: result.rows.map((row) => this.toItem(row)),
      };
    });
  }

  async auditTrail(input: {
    clinicId: string;
    locationId: string;
    holdId: string;
    employee: JwtPayload;
    limit: number;
  }): Promise<HoldAuditTrailResult> {
    return this.database.withTransaction(async (client) => {
      await client.query("SET LOCAL statement_timeout = '250ms'");
      if (!input.employee.clinicIds?.includes(input.clinicId)) {
        throw DomainErrors.clinicScopeMismatch();
      }
      await this.clinicAccess.assertLocationAccess(client, input.employee, input.locationId);
      await this.assertLocationBelongsToClinic(client, input.clinicId, input.locationId);
      await this.assertHoldBelongsToLocation(client, input.holdId, input.locationId);

      const serverNow = await this.dbNow(client);
      const result = await client.query<HoldAuditTrailRow>(`
        SELECT id, occurred_at, actor_type, actor_id, action, correlation_id, payload_json
        FROM audit_schema.audit_log
        WHERE aggregate_type = 'booking_hold'
          AND aggregate_id = $1::uuid
        ORDER BY occurred_at DESC, id DESC
        LIMIT $2
      `, [input.holdId, input.limit]);

      return {
        holdId: input.holdId,
        clinicId: input.clinicId,
        locationId: input.locationId,
        serverNow: serverNow.toISOString(),
        items: result.rows.map((row) => ({
          id: row.id,
          occurredAt: row.occurred_at.toISOString(),
          actorType: row.actor_type,
          actorId: row.actor_id,
          action: row.action,
          correlationId: row.correlation_id,
          payload: row.payload_json,
        })),
      };
    });
  }

  private async assertLocationBelongsToClinic(client: PoolClient, clinicId: string, locationId: string): Promise<void> {
    const result = await client.query<{ id: string }>(`
      SELECT id FROM clinic_schema.clinic_locations
      WHERE id = $1::uuid AND clinic_id = $2::uuid AND status = 'ACTIVE'
      FOR SHARE
    `, [locationId, clinicId]);
    if (!result.rows[0]) throw DomainErrors.clinicScopeMismatch();
  }

  private async assertHoldBelongsToLocation(client: PoolClient, holdId: string, locationId: string): Promise<void> {
    const result = await client.query<{ id: string }>(`
      SELECT h.id
      FROM booking_schema.booking_holds h
      JOIN clinic_schema.appointment_slots s ON s.id = h.slot_id
      WHERE h.id = $1::uuid
        AND s.clinic_location_id = $2::uuid
      FOR SHARE OF h, s
    `, [holdId, locationId]);
    if (!result.rows[0]) throw DomainErrors.clinicScopeMismatch();
  }

  private toItem(row: ManualConfirmationQueueRow): ManualConfirmationQueueItem {
    return {
      holdId: row.hold_id,
      version: row.hold_version,
      holdExpiresAt: row.hold_expires_at.toISOString(),
      manualConfirmPendingAt: row.manual_confirm_pending_at.toISOString(),
      confirmationSlaExpiresAt: row.confirmation_sla_expires_at.toISOString(),
      slot: { id: row.slot_id, startsAt: row.slot_starts_at.toISOString(), endsAt: row.slot_ends_at.toISOString() },
      pet: { id: row.pet_id, name: row.pet_name, species: row.pet_species },
      service: row.service_name ? { displayName: row.service_name } : null,
      latestAudit: row.latest_audit_action && row.latest_audit_at && row.latest_audit_actor_type ? {
        action: row.latest_audit_action,
        occurredAt: row.latest_audit_at.toISOString(),
        actorType: row.latest_audit_actor_type,
      } : null,
    };
  }

  private async dbNow(client: PoolClient): Promise<Date> {
    const result = await client.query<{ now: Date }>('SELECT clock_timestamp() AS now');
    return result.rows[0].now;
  }
}
