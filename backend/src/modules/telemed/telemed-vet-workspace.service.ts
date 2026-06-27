import { HttpStatus, Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { JwtPayload } from '../../auth/auth.types';
import { DomainException } from '../../common/domain-error';
import { DatabaseService } from '../../database/database.service';
import { UpdateTelemedCaseWorkspaceDto } from './dto/update-telemed-case-workspace.dto';
import { DoctorConnectionResult, TelemedService, TelemedSessionResult } from './telemed.service';

interface TelemedVetCaseRow {
  case_id: string;
  state: 'QUEUED' | 'ASSIGNED' | 'DOCTOR_JOINED' | 'IN_PROGRESS';
  queue_priority: number;
  urgency_band: string;
  service_level: string;
  safety_escalation: boolean;
  recommendation_text: string | null;
  follow_up_notes: string | null;
  assigned_employee_id: string | null;
  assigned_at: Date | null;
  created_at: Date;
  updated_at: Date;
  intake_id: string;
  category: string;
  symptom_duration: string;
  prior_clinic_visit: boolean;
  emergency_red_flags: string[];
  pet_id: string;
  pet_name: string;
  pet_species: string;
  pet_breed: string | null;
  pet_birth_date: Date | string | null;
  pet_weight_kg: string | null;
  pet_allergies: string[] | null;
  pet_chronic_conditions: string[] | null;
  latest_event_type: string | null;
  latest_event_at: Date | null;
  session_id: string | null;
  session_state: string | null;
  session_expires_at: Date | null;
}

interface TelemedCaseEventRow {
  id: string;
  actor_type: string;
  actor_id: string | null;
  event_type: string;
  payload_json: Record<string, unknown>;
  created_at: Date;
}

export interface TelemedVetCase {
  caseId: string;
  state: 'QUEUED' | 'ASSIGNED' | 'DOCTOR_JOINED' | 'IN_PROGRESS';
  queuePriority: number;
  urgencyBand: string;
  serviceLevel: string;
  safetyEscalation: boolean;
  recommendationText: string | null;
  followUpNotes: string | null;
  assignedEmployeeId: string | null;
  assignedAt: string | null;
  createdAt: string;
  updatedAt: string;
  intake: {
    id: string;
    category: string;
    symptomDuration: string;
    priorClinicVisit: boolean;
    emergencyRedFlags: string[];
  };
  pet: {
    id: string;
    name: string;
    species: string;
    breed: string | null;
    birthDate: string | null;
    weightKg: string | null;
    allergies: string[];
    chronicConditions: string[];
  };
  latestEvent: { eventType: string; createdAt: string } | null;
  session: { id: string; state: string; expiresAt: string } | null;
}

export interface TelemedVetQueueResult {
  serverNow: string;
  availableCases: TelemedVetCase[];
  assignedCases: TelemedVetCase[];
  restrictedOutputPolicy: {
    allowed: string[];
    forbidden: string[];
  };
}

@Injectable()
export class TelemedVetWorkspaceService {
  constructor(
    private readonly database: DatabaseService,
    private readonly telemedService: TelemedService,
  ) {}

  async queue(input: { employee: JwtPayload; limit: number }): Promise<TelemedVetQueueResult> {
    return this.database.withTransaction(async (client) => {
      await client.query("SET LOCAL statement_timeout = '250ms'");
      const serverNow = await this.dbNow(client);
      const rows = await this.readQueueRows(client, input.employee.sub, input.limit);
      return {
        serverNow: serverNow.toISOString(),
        availableCases: rows.filter((row) => row.state === 'QUEUED').map(toCase),
        assignedCases: rows.filter((row) => row.state !== 'QUEUED').map(toCase),
        restrictedOutputPolicy,
      };
    });
  }

  async assign(input: { caseId: string; employee: JwtPayload }): Promise<TelemedVetCase> {
    return this.database.withTransaction(async (client) => {
      await client.query("SET LOCAL lock_timeout = '50ms'");
      await client.query("SET LOCAL statement_timeout = '250ms'");

      const locked = await client.query<{ id: string; state: string; assigned_employee_id: string | null }>(`
        SELECT id::text, state, assigned_employee_id::text
        FROM telemed_schema.telemed_cases
        WHERE id = $1::uuid
        FOR UPDATE
      `, [input.caseId]);
      const row = locked.rows[0];
      if (!row) throw new DomainException(HttpStatus.NOT_FOUND, 'TELEMED_CASE_NOT_FOUND', 'Telemedicine case not found');
      if (row.state === 'ASSIGNED' && row.assigned_employee_id === input.employee.sub) {
        return this.readCase(client, input.caseId);
      }
      if (row.state === 'ASSIGNED' && row.assigned_employee_id !== input.employee.sub) {
        throw new DomainException(HttpStatus.CONFLICT, 'TELEMED_CASE_ALREADY_ASSIGNED', 'Telemedicine case is already assigned');
      }
      if (row.state !== 'QUEUED') {
        throw new DomainException(HttpStatus.CONFLICT, 'TELEMED_CASE_NOT_ASSIGNABLE', 'Telemedicine case is not queued');
      }

      const assigned = await client.query<{ id: string }>(`
        UPDATE telemed_schema.telemed_cases
        SET state = 'ASSIGNED',
            assigned_employee_id = $2::uuid,
            assigned_at = clock_timestamp(),
            updated_at = clock_timestamp()
        WHERE id = $1::uuid
          AND state = 'QUEUED'
          AND assigned_employee_id IS NULL
        RETURNING id::text
      `, [input.caseId, input.employee.sub]);
      if (!assigned.rows[0]) {
        throw new DomainException(HttpStatus.CONFLICT, 'TELEMED_CASE_ALREADY_ASSIGNED', 'Telemedicine case assignment changed concurrently');
      }

      await this.writeCaseEvent(client, input.caseId, input.employee.sub, 'ASSIGNED', {
        assigneeId: input.employee.sub,
      });
      return this.readCase(client, input.caseId);
    });
  }

  async updateWorkspace(input: {
    caseId: string;
    employee: JwtPayload;
    dto: UpdateTelemedCaseWorkspaceDto;
  }): Promise<TelemedVetCase> {
    return this.database.withTransaction(async (client) => {
      await client.query("SET LOCAL lock_timeout = '50ms'");
      await client.query("SET LOCAL statement_timeout = '250ms'");
      await this.assertAssignedCase(client, input.caseId, input.employee.sub);

      const recommendation = normalizeText(input.dto.recommendationText);
      const followUp = normalizeText(input.dto.followUpNotes);
      if (recommendation && containsForbiddenOutput(recommendation)) {
        throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'TELEMED_RECOMMENDATION_RESTRICTED', 'Recommendation contains restricted medical wording');
      }

      const updated = await client.query<{ id: string }>(`
        UPDATE telemed_schema.telemed_cases
        SET safety_escalation = COALESCE($3::boolean, safety_escalation),
            recommendation_text = COALESCE($4, recommendation_text),
            follow_up_notes = COALESCE($5, follow_up_notes),
            updated_at = clock_timestamp()
        WHERE id = $1::uuid
          AND assigned_employee_id = $2::uuid
          AND state IN ('ASSIGNED', 'DOCTOR_JOINED', 'IN_PROGRESS')
        RETURNING id::text
      `, [
        input.caseId,
        input.employee.sub,
        input.dto.safetyEscalation ?? null,
        recommendation,
        followUp,
      ]);
      if (!updated.rows[0]) {
        throw new DomainException(HttpStatus.CONFLICT, 'TELEMED_CASE_WORKSPACE_CLOSED', 'Telemedicine case is not editable');
      }

      if (input.dto.safetyEscalation === true) {
        await this.writeCaseEvent(client, input.caseId, input.employee.sub, 'SAFETY_ESCALATED', {});
      }
      if (recommendation) {
        await this.writeCaseEvent(client, input.caseId, input.employee.sub, 'RECOMMENDATION_SAVED', { recommendationText: recommendation });
      }
      if (followUp) {
        await this.writeCaseEvent(client, input.caseId, input.employee.sub, 'FOLLOW_UP_ROUTED', { followUpNotes: followUp });
      }
      return this.readCase(client, input.caseId);
    });
  }

  async startSession(input: { caseId: string; employee: JwtPayload }): Promise<TelemedSessionResult> {
    return this.telemedService.startSessionForCase(input.caseId, input.employee.sub);
  }

  async connectDoctor(input: {
    caseId: string;
    sessionId: string;
    employee: JwtPayload;
  }): Promise<DoctorConnectionResult> {
    await this.database.withTransaction(async (client) => {
      await client.query("SET LOCAL statement_timeout = '250ms'");
      await this.assertAssignedCase(client, input.caseId, input.employee.sub);
      const result = await client.query<{ assigned_employee_id: string | null }>(`
        SELECT telemed_case.assigned_employee_id::text
        FROM telemed_schema.telemed_cases telemed_case
        JOIN telemed_schema.telemed_sessions session ON session.telemed_case_id = telemed_case.id
        WHERE telemed_case.id = $1::uuid
          AND session.id = $2::uuid
        FOR SHARE
      `, [input.caseId, input.sessionId]);
      const row = result.rows[0];
      if (!row) throw new DomainException(HttpStatus.NOT_FOUND, 'TELEMED_SESSION_NOT_FOUND', 'Telemedicine session not found');
      if (row.assigned_employee_id !== input.employee.sub) {
        throw new DomainException(HttpStatus.FORBIDDEN, 'TELEMED_CASE_ASSIGNEE_MISMATCH', 'Telemedicine case is assigned to another veterinarian');
      }
    });

    const connected = await this.telemedService.connectDoctor(input.sessionId, input.employee.sub);
    await this.database.query(`
      INSERT INTO telemed_schema.telemed_case_events (case_id, actor_type, actor_id, event_type, payload_json)
      VALUES ($1::uuid, 'TELEMED_VETERINARIAN', $2::uuid, 'DOCTOR_CONNECTED', jsonb_build_object('sessionId', $3::uuid))
    `, [input.caseId, input.employee.sub, input.sessionId]);
    return connected;
  }

  async auditTrail(input: { caseId: string; employee: JwtPayload; limit: number }) {
    return this.database.withTransaction(async (client) => {
      await client.query("SET LOCAL statement_timeout = '250ms'");
      await this.assertAssignedCase(client, input.caseId, input.employee.sub);
      const serverNow = await this.dbNow(client);
      const result = await client.query<TelemedCaseEventRow>(`
        SELECT id::text, actor_type, actor_id::text, event_type, payload_json, created_at
        FROM telemed_schema.telemed_case_events
        WHERE case_id = $1::uuid
        ORDER BY created_at DESC, id DESC
        LIMIT $2
      `, [input.caseId, input.limit]);
      return {
        caseId: input.caseId,
        serverNow: serverNow.toISOString(),
        items: result.rows.map((row) => ({
          id: row.id,
          actorType: row.actor_type,
          actorId: row.actor_id,
          eventType: row.event_type,
          payload: row.payload_json,
          createdAt: row.created_at.toISOString(),
        })),
      };
    });
  }

  private async assertAssignedCase(client: PoolClient, caseId: string, employeeId: string): Promise<void> {
    const result = await client.query<{ assigned_employee_id: string | null }>(`
      SELECT assigned_employee_id::text
      FROM telemed_schema.telemed_cases
      WHERE id = $1::uuid
      FOR SHARE
    `, [caseId]);
    const row = result.rows[0];
    if (!row) throw new DomainException(HttpStatus.NOT_FOUND, 'TELEMED_CASE_NOT_FOUND', 'Telemedicine case not found');
    if (row.assigned_employee_id !== employeeId) {
      throw new DomainException(HttpStatus.FORBIDDEN, 'TELEMED_CASE_ASSIGNEE_MISMATCH', 'Telemedicine case is assigned to another veterinarian');
    }
  }

  private async readQueueRows(client: PoolClient, employeeId: string, limit: number): Promise<TelemedVetCaseRow[]> {
    const result = await client.query<TelemedVetCaseRow>(baseCaseQuery(`
      WHERE telemed_case.state = 'QUEUED'
         OR (
           telemed_case.assigned_employee_id = $1::uuid
           AND telemed_case.state IN ('ASSIGNED', 'DOCTOR_JOINED', 'IN_PROGRESS')
         )
      ORDER BY
        CASE telemed_case.state WHEN 'QUEUED' THEN 0 ELSE 1 END,
        telemed_case.safety_escalation DESC,
        telemed_case.queue_priority DESC,
        telemed_case.created_at ASC
      LIMIT $2
    `), [employeeId, limit]);
    return result.rows;
  }

  private async readCase(client: PoolClient, caseId: string): Promise<TelemedVetCase> {
    const result = await client.query<TelemedVetCaseRow>(baseCaseQuery(`
      WHERE telemed_case.id = $1::uuid
      LIMIT 1
    `), [caseId]);
    const row = result.rows[0];
    if (!row) throw new DomainException(HttpStatus.NOT_FOUND, 'TELEMED_CASE_NOT_FOUND', 'Telemedicine case not found');
    return toCase(row);
  }

  private async dbNow(client: PoolClient): Promise<Date> {
    const result = await client.query<{ now: Date }>('SELECT clock_timestamp() AS now');
    return result.rows[0].now;
  }

  private async writeCaseEvent(
    client: PoolClient,
    caseId: string,
    actorId: string,
    eventType: 'ASSIGNED' | 'SAFETY_ESCALATED' | 'RECOMMENDATION_SAVED' | 'FOLLOW_UP_ROUTED',
    payload: Record<string, unknown>,
  ): Promise<void> {
    await client.query(`
      INSERT INTO telemed_schema.telemed_case_events (case_id, actor_type, actor_id, event_type, payload_json)
      VALUES ($1::uuid, 'TELEMED_VETERINARIAN', $2::uuid, $3, $4::jsonb)
    `, [caseId, actorId, eventType, JSON.stringify(payload)]);
  }
}

const restrictedOutputPolicy = {
  allowed: [
    'educational guidance',
    'next safe step',
    'follow-up checklist',
    'urgent clinic recommendation',
    'general monitoring guidance',
  ],
  forbidden: [
    'prescription document',
    'diagnosis confirmed wording',
    'emergency delay',
    'unapproved medication flow',
  ],
};

function baseCaseQuery(tail: string): string {
  return `
    SELECT
      telemed_case.id::text AS case_id,
      telemed_case.state,
      telemed_case.queue_priority,
      telemed_case.urgency_band,
      telemed_case.service_level,
      telemed_case.safety_escalation,
      telemed_case.recommendation_text,
      telemed_case.follow_up_notes,
      telemed_case.assigned_employee_id::text,
      telemed_case.assigned_at,
      telemed_case.created_at,
      telemed_case.updated_at,
      intake.id::text AS intake_id,
      intake.category,
      intake.symptom_duration,
      intake.prior_clinic_visit,
      intake.emergency_red_flags,
      pet.id::text AS pet_id,
      pet.name AS pet_name,
      pet.species AS pet_species,
      pet.breed AS pet_breed,
      pet.birth_date AS pet_birth_date,
      pet.weight_kg::text AS pet_weight_kg,
      pet.allergies AS pet_allergies,
      pet.chronic_conditions AS pet_chronic_conditions,
      latest.event_type AS latest_event_type,
      latest.created_at AS latest_event_at,
      session.id::text AS session_id,
      session.state AS session_state,
      session.expires_at AS session_expires_at
    FROM telemed_schema.telemed_cases telemed_case
    JOIN telemed_schema.telemed_intakes intake ON intake.id = telemed_case.intake_id
    JOIN pet_schema.pets pet ON pet.id = telemed_case.pet_id
    LEFT JOIN telemed_schema.telemed_sessions session ON session.telemed_case_id = telemed_case.id
    LEFT JOIN LATERAL (
      SELECT event_type, created_at
      FROM telemed_schema.telemed_case_events
      WHERE case_id = telemed_case.id
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    ) latest ON true
    ${tail}
  `;
}

function toCase(row: TelemedVetCaseRow): TelemedVetCase {
  return {
    caseId: row.case_id,
    state: row.state,
    queuePriority: row.queue_priority,
    urgencyBand: row.urgency_band,
    serviceLevel: row.service_level,
    safetyEscalation: row.safety_escalation,
    recommendationText: row.recommendation_text,
    followUpNotes: row.follow_up_notes,
    assignedEmployeeId: row.assigned_employee_id,
    assignedAt: row.assigned_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    intake: {
      id: row.intake_id,
      category: row.category,
      symptomDuration: row.symptom_duration,
      priorClinicVisit: row.prior_clinic_visit,
      emergencyRedFlags: row.emergency_red_flags ?? [],
    },
    pet: {
      id: row.pet_id,
      name: row.pet_name,
      species: row.pet_species,
      breed: row.pet_breed,
      birthDate: row.pet_birth_date ? new Date(row.pet_birth_date).toISOString().slice(0, 10) : null,
      weightKg: row.pet_weight_kg,
      allergies: row.pet_allergies ?? [],
      chronicConditions: row.pet_chronic_conditions ?? [],
    },
    latestEvent: row.latest_event_type && row.latest_event_at
      ? { eventType: row.latest_event_type, createdAt: row.latest_event_at.toISOString() }
      : null,
    session: row.session_id && row.session_state && row.session_expires_at
      ? { id: row.session_id, state: row.session_state, expiresAt: row.session_expires_at.toISOString() }
      : null,
  };
}

function normalizeText(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function containsForbiddenOutput(value: string): boolean {
  const lower = value.toLocaleLowerCase('ru-RU');
  return [
    'диагноз подтвержден',
    'диагноз подтверждён',
    'назначаю рецепт',
    'рецепт',
    'не срочно, подождите',
    'не обращайтесь в клинику',
  ].some((fragment) => lower.includes(fragment));
}
