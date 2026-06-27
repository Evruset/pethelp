import { HttpStatus, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DomainException, DomainErrors } from '../../common/domain-error';
import { DatabaseService } from '../../database/database.service';
import { TraceContext } from '../../observability/trace-context.context';
import { CreateInsuranceProfileDto } from './dto/create-insurance-profile.dto';

export type CoverageCheckState = 'CONSENT_REQUIRED' | 'REQUESTED' | 'PROCESSING' | 'COVERED' | 'NOT_COVERED' | 'MANUAL_REVIEW' | 'FAILED' | 'EXPIRED';

export interface CoverageCheckView {
  id: string;
  petId: string;
  partnerCode: string;
  state: CoverageCheckState;
  consentVersion: string | null;
  version: number;
  serverNow: string;
}

export interface InsuranceProfileView {
  id: string;
  petId: string;
  insurerCode: string;
  policyReferenceMasked: string;
  petRelation: string;
  validFrom: string | null;
  validUntil: string | null;
  verificationState: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';
  consentVersion: string;
  consentedAt: string;
  providerDataMasked: Record<string, unknown>;
  version: number;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class InsuranceService {
  constructor(
    private readonly database: DatabaseService,
    private readonly traceContext: TraceContext,
  ) {}

  async listProfiles(ownerId: string): Promise<InsuranceProfileView[]> {
    const result = await this.database.query<InsuranceProfileRow>(`
      SELECT id::text, pet_id::text, insurer_code, policy_reference_masked,
             pet_relation, valid_from::text, valid_until::text,
             verification_state, consent_version, consented_at,
             provider_data_masked, version, created_at, updated_at
      FROM insurance_schema.insurance_profiles
      WHERE owner_id = $1::uuid
      ORDER BY created_at DESC, id DESC
      LIMIT 100
    `, [ownerId]);
    return result.rows.map(profileView);
  }

  async createProfile(ownerId: string, input: CreateInsuranceProfileDto): Promise<InsuranceProfileView> {
    return this.database.withTransaction(async (client) => {
      await client.query("SET LOCAL lock_timeout = '50ms'");
      await client.query("SET LOCAL statement_timeout = '250ms'");
      const pet = await client.query<{ id: string }>(
        'SELECT id::text FROM pet_schema.pets WHERE id = $1::uuid AND owner_id = $2::uuid FOR SHARE',
        [input.petId, ownerId],
      );
      if (!pet.rows[0]) throw DomainErrors.petOwnershipMismatch();

      const policyReference = input.policyReference.trim();
      const insurerCode = input.insurerCode.trim().toUpperCase();
      const hash = policyHash(insurerCode, policyReference);
      const masked = maskPolicyReference(policyReference);
      const result = await client.query<InsuranceProfileRow>(`
        INSERT INTO insurance_schema.insurance_profiles AS profiles (
          owner_id, pet_id, insurer_code, policy_reference_hash,
          policy_reference_masked, pet_relation, valid_from, valid_until,
          consent_version, provider_data_masked
        ) VALUES (
          $1::uuid, $2::uuid, $3, $4, $5, $6, $7::date, $8::date, $9, $10::jsonb
        )
        ON CONFLICT (owner_id, insurer_code, policy_reference_hash) DO UPDATE
        SET pet_id = EXCLUDED.pet_id,
            pet_relation = EXCLUDED.pet_relation,
            valid_from = EXCLUDED.valid_from,
            valid_until = EXCLUDED.valid_until,
            consent_version = EXCLUDED.consent_version,
            consented_at = clock_timestamp(),
            provider_data_masked = EXCLUDED.provider_data_masked,
            version = profiles.version + 1,
            updated_at = clock_timestamp()
        RETURNING id::text, pet_id::text, insurer_code, policy_reference_masked,
          pet_relation, valid_from::text, valid_until::text, verification_state,
          consent_version, consented_at, provider_data_masked, version,
          created_at, updated_at
      `, [
        ownerId,
        input.petId,
        insurerCode,
        hash,
        masked,
        input.petRelation,
        input.validFrom ?? null,
        input.validUntil ?? null,
        input.consentVersion.trim(),
        JSON.stringify(maskProviderData(input.providerDataMasked ?? {})),
      ]);
      return profileView(result.rows[0]);
    });
  }

  async create(input: { ownerId: string; petId: string; partnerCode: string; consentVersion?: string }): Promise<CoverageCheckView> {
    return this.database.withTransaction(async (client) => {
      await client.query("SET LOCAL lock_timeout = '50ms'");
      await client.query("SET LOCAL statement_timeout = '250ms'");
      const pet = await client.query<{ id: string }>(
        'SELECT id::text FROM pet_schema.pets WHERE id = $1::uuid AND owner_id = $2::uuid FOR SHARE',
        [input.petId, input.ownerId],
      );
      if (!pet.rows[0]) throw DomainErrors.petOwnershipMismatch();

      const state: CoverageCheckState = input.consentVersion ? 'REQUESTED' : 'CONSENT_REQUIRED';
      const created = await client.query<{
        id: string; pet_id: string; partner_code: string; state: CoverageCheckState; consent_version: string | null; version: number; server_now: Date;
      }>(`
        INSERT INTO insurance_schema.coverage_checks (owner_id, pet_id, partner_code, state, consent_version, consented_at)
        VALUES ($1::uuid, $2::uuid, $3, $4, $5, CASE WHEN $5::text IS NULL THEN NULL ELSE clock_timestamp() END)
        RETURNING id::text, pet_id::text, partner_code, state, consent_version, version, clock_timestamp() AS server_now
      `, [input.ownerId, input.petId, input.partnerCode.trim(), state, input.consentVersion?.trim() || null]);
      const row = created.rows[0];

      if (state === 'REQUESTED') {
        await client.query(`
          INSERT INTO booking_schema.outbox_events (
            event_type, aggregate_type, aggregate_id, aggregate_version, correlation_id, payload_json, deduplication_key
          ) VALUES (
            'insurance.coverage.requested.v1', 'insurance_coverage_check', $1::uuid, $2, $3::uuid, $4::jsonb, $5
          )
        `, [
          row.id,
          row.version,
          this.traceContext.getCorrelationId() ?? null,
          JSON.stringify({ coverageCheckId: row.id, ownerId: input.ownerId, petId: row.pet_id, partnerCode: row.partner_code, consentVersion: row.consent_version }),
          `insurance.coverage.requested.v1:${row.id}:${row.version}`,
        ]);
      }

      return this.view(row);
    });
  }

  async read(id: string, ownerId: string): Promise<CoverageCheckView> {
    const result = await this.database.query<{
      id: string; pet_id: string; partner_code: string; state: CoverageCheckState; consent_version: string | null; version: number; server_now: Date;
    }>(`
      SELECT id::text, pet_id::text, partner_code, state, consent_version, version, clock_timestamp() AS server_now
      FROM insurance_schema.coverage_checks
      WHERE id = $1::uuid AND owner_id = $2::uuid
    `, [id, ownerId]);
    if (!result.rows[0]) {
      throw new DomainException(HttpStatus.NOT_FOUND, 'INSURANCE_COVERAGE_CHECK_NOT_FOUND', 'Coverage check not found');
    }
    return this.view(result.rows[0]);
  }

  private view(row: { id: string; pet_id: string; partner_code: string; state: CoverageCheckState; consent_version: string | null; version: number; server_now: Date }): CoverageCheckView {
    return { id: row.id, petId: row.pet_id, partnerCode: row.partner_code, state: row.state, consentVersion: row.consent_version, version: row.version, serverNow: row.server_now.toISOString() };
  }
}

interface InsuranceProfileRow {
  id: string;
  pet_id: string;
  insurer_code: string;
  policy_reference_masked: string;
  pet_relation: string;
  valid_from: string | null;
  valid_until: string | null;
  verification_state: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';
  consent_version: string;
  consented_at: Date;
  provider_data_masked: Record<string, unknown>;
  version: number;
  created_at: Date;
  updated_at: Date;
}

function profileView(row: InsuranceProfileRow): InsuranceProfileView {
  return {
    id: row.id,
    petId: row.pet_id,
    insurerCode: row.insurer_code,
    policyReferenceMasked: row.policy_reference_masked,
    petRelation: row.pet_relation,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    verificationState: row.verification_state,
    consentVersion: row.consent_version,
    consentedAt: row.consented_at.toISOString(),
    providerDataMasked: row.provider_data_masked,
    version: row.version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function policyHash(insurerCode: string, policyReference: string): string {
  return createHash('sha256')
    .update(`${insurerCode}:${policyReference.trim().toUpperCase()}`)
    .digest('hex');
}

function maskPolicyReference(value: string): string {
  const normalized = value.replace(/\s+/g, '');
  if (normalized.length <= 4) return '••••';
  return `•••• ${normalized.slice(-4)}`;
}

function maskProviderData(input: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string') {
      result[key] = value.length <= 4 ? '••••' : `•••• ${value.slice(-4)}`;
    } else if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
      result[key] = value;
    }
  }
  return result;
}
