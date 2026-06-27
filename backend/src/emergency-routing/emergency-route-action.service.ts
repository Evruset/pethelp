import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RecordEmergencyRouteActionDto } from './dto/record-emergency-route-action.dto';

interface RouteActionRow {
  id: string;
  action: 'CALL_STARTED' | 'ROUTE_OPENED' | 'FOLLOW_UP_REQUESTED';
  clinic_location_id: string;
  triage_session_id: string | null;
  follow_up_due_at: Date | null;
  created_at: Date;
}

interface TriageSessionRow {
  id: string;
  outcome: string;
}

@Injectable()
export class EmergencyRouteActionService {
  constructor(private readonly database: DatabaseService) {}

  async record(dto: RecordEmergencyRouteActionDto) {
    return this.database.withTransaction(async (client) => {
      await client.query("SET LOCAL statement_timeout = '250ms'");

      const location = await client.query<{ id: string }>(`
        SELECT id::text
        FROM clinic_schema.clinic_locations
        WHERE id = $1::uuid
      `, [dto.clinicLocationId]);
      if (!location.rows[0]) {
        throw new BadRequestException({ code: 'EMERGENCY_LOCATION_NOT_FOUND', message: 'Clinic location was not found.' });
      }

      let triage: TriageSessionRow | null = null;
      if (dto.triageSessionId) {
        const triageResult = await client.query<TriageSessionRow>(`
          SELECT id::text, outcome
          FROM clinic_schema.emergency_triage_sessions
          WHERE id = $1::uuid
        `, [dto.triageSessionId]);
        triage = triageResult.rows[0] ?? null;
        if (!triage) {
          throw new BadRequestException({ code: 'TRIAGE_SESSION_NOT_FOUND', message: 'Triage session was not found.' });
        }
      }

      const followUpDueAt = dto.action === 'FOLLOW_UP_REQUESTED'
        ? followUpDelay(triage?.outcome ?? null)
        : null;
      const result = await client.query<RouteActionRow>(`
        INSERT INTO clinic_schema.emergency_route_actions (
          triage_session_id, clinic_location_id, action, follow_up_due_at, source
        ) VALUES ($1::uuid, $2::uuid, $3, $4::interval + clock_timestamp(), $5)
        RETURNING id::text, action, clinic_location_id::text, triage_session_id::text, follow_up_due_at, created_at
      `, [
        dto.triageSessionId ?? null,
        dto.clinicLocationId,
        dto.action,
        followUpDueAt,
        dto.source?.trim() || 'owner_mobile',
      ]);

      const row = result.rows[0];
      return {
        actionId: row.id,
        action: row.action,
        clinicLocationId: row.clinic_location_id,
        triageSessionId: row.triage_session_id,
        followUpDueAt: row.follow_up_due_at?.toISOString() ?? null,
        createdAt: row.created_at.toISOString(),
      };
    });
  }
}

function followUpDelay(outcome: string | null): string {
  if (outcome === 'PLANNED_VISIT' || outcome === 'TELEMED_ELIGIBLE') return '7 days';
  if (outcome === 'SAME_DAY_CLINIC') return '2 days';
  return '1 day';
}
