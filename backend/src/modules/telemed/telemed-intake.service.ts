import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateTelemedIntakeDto } from './dto/create-telemed-intake.dto';

type TelemedEligibilityOutcome =
  | 'EMERGENCY'
  | 'SAME_DAY_CLINIC'
  | 'TELEMED_ELIGIBLE'
  | 'INSUFFICIENT_DATA';

type TelemedRoutingTarget =
  | 'EMERGENCY_ROUTE'
  | 'CLINIC_BOOKING'
  | 'TELEMED_PAYMENT_QUEUE'
  | 'GUIDED_QUESTIONS';

interface TelemedIntakeRow {
  id: string;
  eligibility_outcome: TelemedEligibilityOutcome;
  routing_target: TelemedRoutingTarget;
  guardrails: string[];
  created_at: Date;
}

const emergencySignals = new Set([
  'BREATHING_DISTRESS',
  'COLLAPSE_OR_UNCONSCIOUS',
  'SEIZURE',
  'SEVERE_BLEEDING',
  'MAJOR_TRAUMA',
  'TOXIN_INGESTION',
  'BLOAT_OR_BLOCKED_URINATION',
]);

@Injectable()
export class TelemedIntakeService {
  constructor(private readonly database: DatabaseService) {}

  async create(ownerId: string, dto: CreateTelemedIntakeDto) {
    const consentVersion = dto.consentVersion.trim();
    if (!consentVersion) {
      throw new BadRequestException({ code: 'TELEMED_CONSENT_REQUIRED', message: 'Telemedicine consent is required.' });
    }
    const redFlags = normalizeCodes(dto.emergencyRedFlags);
    const attachments = normalizeAttachmentRefs(dto.attachmentRefs ?? []);
    const eligibility = decideEligibility(dto, redFlags);

    return this.database.withTransaction(async (client) => {
      await client.query("SET LOCAL statement_timeout = '250ms'");
      const pet = await client.query<{ id: string; species: string }>(`
        SELECT id::text, species
        FROM pet_schema.pets
        WHERE id = $1::uuid AND owner_id = $2::uuid
        FOR SHARE
      `, [dto.petId, ownerId]);
      if (!pet.rows[0]) {
        throw new NotFoundException({ code: 'OWNER_PET_NOT_FOUND', message: 'Pet was not found.' });
      }

      const result = await client.query<TelemedIntakeRow>(`
        INSERT INTO telemed_schema.telemed_intakes (
          owner_id, pet_id, category, symptom_duration, prior_clinic_visit,
          emergency_red_flags, attachment_refs, consent_version,
          expected_service_level, eligibility_outcome, routing_target, guardrails
        ) VALUES (
          $1::uuid, $2::uuid, $3, $4, $5, $6::text[], $7::text[], $8, $9, $10, $11, $12::text[]
        )
        RETURNING id::text, eligibility_outcome, routing_target, guardrails, created_at
      `, [
        ownerId,
        dto.petId,
        dto.category,
        dto.symptomDuration,
        dto.priorClinicVisit,
        redFlags,
        attachments,
        consentVersion,
        dto.expectedServiceLevel ?? 'STANDARD',
        eligibility.outcome,
        eligibility.routingTarget,
        guardrails(),
      ]);

      const row = result.rows[0];
      return {
        intakeId: row.id,
        outcome: row.eligibility_outcome,
        routingTarget: row.routing_target,
        nextStep: nextStep(row.routing_target),
        guardrails: row.guardrails,
        createdAt: row.created_at.toISOString(),
      };
    });
  }
}

function decideEligibility(
  dto: CreateTelemedIntakeDto,
  redFlags: string[],
): { outcome: TelemedEligibilityOutcome; routingTarget: TelemedRoutingTarget } {
  if (redFlags.some((signal) => emergencySignals.has(signal))) {
    return { outcome: 'EMERGENCY', routingTarget: 'EMERGENCY_ROUTE' };
  }
  if (dto.category === 'OTHER' && dto.symptomDuration !== 'NO_SYMPTOMS') {
    return { outcome: 'INSUFFICIENT_DATA', routingTarget: 'GUIDED_QUESTIONS' };
  }
  if (dto.category === 'VOMITING_DIARRHEA' || dto.category === 'PAIN_LAMENESS') {
    return { outcome: 'SAME_DAY_CLINIC', routingTarget: 'CLINIC_BOOKING' };
  }
  return { outcome: 'TELEMED_ELIGIBLE', routingTarget: 'TELEMED_PAYMENT_QUEUE' };
}

function guardrails(): string[] {
  return [
    'Telemedicine does not replace emergency care.',
    'VetHelp does not promise a diagnosis in telemedicine intake.',
    'Telemedicine intake does not create prescriptions.',
    'Telemedicine intake does not confirm insurance coverage.',
    'A veterinarian may still recommend an in-person examination.',
  ];
}

function nextStep(target: TelemedRoutingTarget): string {
  switch (target) {
    case 'EMERGENCY_ROUTE':
      return 'Open emergency routing and call a verified clinic before travel.';
    case 'CLINIC_BOOKING':
      return 'Book an in-person clinic visit today.';
    case 'TELEMED_PAYMENT_QUEUE':
      return 'Continue to telemedicine payment and doctor queue.';
    case 'GUIDED_QUESTIONS':
      return 'Answer more questions or choose a clinic route if symptoms are worsening.';
  }
}

function normalizeCodes(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim().toUpperCase()).filter(Boolean))].sort();
}

function normalizeAttachmentRefs(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
