import { HttpStatus, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { DomainException, DomainErrors } from '../../common/domain-error';
import { DatabaseService } from '../../database/database.service';
import { TraceContext } from '../../observability/trace-context.context';
import { CreateInsuranceProfileDto } from './dto/create-insurance-profile.dto';
import { InsuranceProviderAdapter, InsuranceProviderPolicySummary } from './insurance-provider-adapter.service';

export type CoverageCheckState = 'CONSENT_REQUIRED' | 'REQUESTED' | 'PROCESSING' | 'COVERED' | 'NOT_COVERED' | 'MANUAL_REVIEW' | 'FAILED' | 'EXPIRED';

export interface ClaimDraftView {
  draftId: string;
  partnerCode: string;
  status: string;
  requiredDocuments: string[];
  createdAt: string;
  expiresAt: string;
}

export interface CoverageCheckView {
  id: string;
  petId: string;
  partnerCode: string;
  state: CoverageCheckState;
  consentVersion: string | null;
  providerReference: string | null;
  responseSummary: Record<string, unknown>;
  providerCheckedAt: string | null;
  coverageValidUntil: string | null;
  claimDraft: ClaimDraftView | null;
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
  consentRevokedAt: string | null;
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
    private readonly providerAdapter: InsuranceProviderAdapter,
  ) {}

  async listProfiles(ownerId: string): Promise<InsuranceProfileView[]> {
    const result = await this.database.query<InsuranceProfileRow>(`
      SELECT id::text, pet_id::text, insurer_code, policy_reference_masked,
             pet_relation, valid_from::text, valid_until::text,
             verification_state, consent_version, consented_at,
             consent_revoked_at, provider_data_masked, version, created_at, updated_at
      FROM insurance_schema.insurance_profiles
      WHERE owner_id = $1::uuid
        AND consent_revoked_at IS NULL
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
            consent_revoked_at = NULL,
            consent_revocation_reason = NULL,
            provider_data_masked = EXCLUDED.provider_data_masked,
            version = profiles.version + 1,
            updated_at = clock_timestamp()
        RETURNING id::text, pet_id::text, insurer_code, policy_reference_masked,
          pet_relation, valid_from::text, valid_until::text, verification_state,
          consent_version, consented_at, consent_revoked_at, provider_data_masked, version,
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
      const profile = result.rows[0];
      await this.writeInsuranceAudit(client, ownerId, profile.id, 'insurance_profile', 'consent.granted', {
        consentVersion: profile.consent_version,
        insurerCode: profile.insurer_code,
        petId: profile.pet_id,
        source: 'insurance_profile',
      });
      return profileView(profile);
    });
  }

  async revokeProfileConsent(ownerId: string, profileId: string): Promise<{ revoked: true; profileId: string; serverNow: string }> {
    return this.database.withTransaction(async (client) => {
      await client.query("SET LOCAL lock_timeout = '50ms'");
      await client.query("SET LOCAL statement_timeout = '250ms'");
      const result = await client.query<InsuranceProfileRow>(`
        UPDATE insurance_schema.insurance_profiles
        SET consent_revoked_at = COALESCE(consent_revoked_at, clock_timestamp()),
            consent_revocation_reason = COALESCE(consent_revocation_reason, 'OWNER_REVOKED'),
            verification_state = 'EXPIRED',
            version = version + 1,
            updated_at = clock_timestamp()
        WHERE id = $1::uuid
          AND owner_id = $2::uuid
        RETURNING id::text, pet_id::text, insurer_code, policy_reference_masked,
          pet_relation, valid_from::text, valid_until::text, verification_state,
          consent_version, consented_at, consent_revoked_at, provider_data_masked, version,
          created_at, updated_at
      `, [profileId, ownerId]);
      const profile = result.rows[0];
      if (!profile) {
        throw new DomainException(HttpStatus.NOT_FOUND, 'INSURANCE_PROFILE_NOT_FOUND', 'Insurance profile not found');
      }

      await this.writeInsuranceAudit(client, ownerId, profile.id, 'insurance_profile', 'consent.revoked', {
        consentVersion: profile.consent_version,
        insurerCode: profile.insurer_code,
        petId: profile.pet_id,
        source: 'insurance_profile',
      });
      const serverNow = await client.query<{ now: Date }>('SELECT clock_timestamp() AS now');
      return { revoked: true, profileId: profile.id, serverNow: serverNow.rows[0].now.toISOString() };
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
      const created = await client.query<CoverageCheckRow>(`
        INSERT INTO insurance_schema.coverage_checks (owner_id, pet_id, partner_code, state, consent_version, consented_at)
        VALUES ($1::uuid, $2::uuid, $3, $4, $5, CASE WHEN $5::text IS NULL THEN NULL ELSE clock_timestamp() END)
        RETURNING id::text, owner_id::text, pet_id::text, partner_code, state,
          consent_version, provider_reference, response_summary_json,
          provider_checked_at, coverage_valid_until, claim_draft_json, version,
          clock_timestamp() AS server_now
      `, [input.ownerId, input.petId, input.partnerCode.trim(), state, input.consentVersion?.trim() || null]);
      const row = created.rows[0];

      if (state === 'REQUESTED') {
        await this.writeInsuranceAudit(client, input.ownerId, row.id, 'insurance_coverage_check', 'consent.granted', {
          consentVersion: row.consent_version,
          partnerCode: row.partner_code,
          petId: row.pet_id,
          source: 'coverage_check',
        });
        await this.writeInsuranceAudit(client, input.ownerId, row.id, 'insurance_coverage_check', 'insurance.request.created', {
          coverageCheckId: row.id,
          partnerCode: row.partner_code,
          petId: row.pet_id,
          state: row.state,
        });
        await client.query(`
          INSERT INTO booking_schema.outbox_events (
            event_type, aggregate_type, aggregate_id, aggregate_version, correlation_id,
            causation_id, traceparent, payload_json, deduplication_key
          ) VALUES (
            'insurance.coverage.requested.v1', 'insurance_coverage_check', $1::uuid, $2, $3::uuid,
            $4::uuid, $5, $6::jsonb, $7
          )
        `, [
          row.id,
          row.version,
          this.traceContext.getCorrelationId() ?? null,
          this.traceContext.getCausationId() ?? null,
          this.traceContext.getTraceparent() ?? null,
          JSON.stringify({ coverageCheckId: row.id, ownerId: input.ownerId, petId: row.pet_id, partnerCode: row.partner_code, consentVersion: row.consent_version }),
          `insurance.coverage.requested.v1:${row.id}:${row.version}`,
        ]);
      }

      return this.view(row);
    });
  }

  private async writeInsuranceAudit(
    client: PoolClient,
    ownerId: string,
    aggregateId: string,
    aggregateType: string,
    action: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await client.query(`
      INSERT INTO audit_schema.audit_log (
        actor_type, actor_id, action, aggregate_type, aggregate_id,
        correlation_id, causation_id, traceparent, payload_json
      ) VALUES (
        'OWNER', $1, $2, $3, $4::uuid,
        $5::uuid, $6::uuid, $7, $8::jsonb
      )
    `, [
      ownerId,
      action,
      aggregateType,
      aggregateId,
      this.traceContext.getCorrelationId() ?? null,
      this.traceContext.getCausationId() ?? null,
      this.traceContext.getTraceparent() ?? null,
      JSON.stringify(payload),
    ]);
  }

  async read(id: string, ownerId: string): Promise<CoverageCheckView> {
    const result = await this.database.query<CoverageCheckRow>(`
      SELECT id::text, owner_id::text, pet_id::text, partner_code, state,
             consent_version, provider_reference, response_summary_json,
             provider_checked_at, coverage_valid_until, claim_draft_json,
             version, clock_timestamp() AS server_now
      FROM insurance_schema.coverage_checks
      WHERE id = $1::uuid AND owner_id = $2::uuid
    `, [id, ownerId]);
    if (!result.rows[0]) {
      throw new DomainException(HttpStatus.NOT_FOUND, 'INSURANCE_COVERAGE_CHECK_NOT_FOUND', 'Coverage check not found');
    }
    return this.view(result.rows[0]);
  }

  async processCoverageRequest(id: string): Promise<CoverageCheckView> {
    const prepared = await this.markProcessing(id);
    if (!prepared) {
      return this.readInternal(id);
    }

    try {
      const validation = await this.providerAdapter.validatePolicy(prepared.request);
      if (prepared.profile) {
        await this.updateProfileVerification(prepared.profile.id, validation.verificationState, validation.providerDataMasked);
      }
      const coverage = await this.providerAdapter.checkCoverage(prepared.request);
      const claimDraft = await this.providerAdapter.createClaimDraft(prepared.request, coverage);
      await this.providerAdapter.createLead(prepared.request);
      return this.storeProviderResult(id, coverage.state, {
        providerReference: coverage.providerReference,
        responseSummary: coverage.responseSummary,
        providerCheckedAt: coverage.checkedAt,
        coverageValidUntil: coverage.coverageValidUntil,
        claimDraft: claimDraft ? { ...claimDraft } : null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Insurance partner processing failed';
      return this.storeProviderResult(id, 'FAILED', {
        providerReference: prepared.providerReference,
        responseSummary: {
          statusText: 'Partner request failed. VetHelp will not infer coverage.',
          error: message.slice(0, 240),
        },
        providerCheckedAt: new Date(),
        coverageValidUntil: null,
        claimDraft: null,
      });
    }
  }

  private async markProcessing(id: string): Promise<PreparedCoverageRequest | null> {
    return this.database.withTransaction(async (client) => {
      await client.query("SET LOCAL lock_timeout = '50ms'");
      await client.query("SET LOCAL statement_timeout = '500ms'");
      const result = await client.query<CoverageCheckRow>(`
        UPDATE insurance_schema.coverage_checks
        SET state = 'PROCESSING',
            version = version + 1,
            updated_at = clock_timestamp()
        WHERE id = $1::uuid
          AND state = 'REQUESTED'
        RETURNING id::text, owner_id::text, pet_id::text, partner_code, state,
          consent_version, provider_reference, response_summary_json,
          provider_checked_at, coverage_valid_until, claim_draft_json, version,
          clock_timestamp() AS server_now
      `, [id]);
      const row = result.rows[0];
      if (!row) return null;
      const profile = await this.findProfileForCheck(row.owner_id, row.pet_id, row.partner_code);
      return {
        row,
        profile,
        providerReference: row.provider_reference ?? `${row.partner_code}-${row.id.slice(0, 8).toUpperCase()}`,
        request: {
          coverageCheckId: row.id,
          ownerId: row.owner_id,
          petId: row.pet_id,
          partnerCode: row.partner_code,
          consentVersion: row.consent_version ?? 'unknown',
          policy: profile ? policySummary(profile) : null,
        },
      };
    });
  }

  private async findProfileForCheck(ownerId: string, petId: string, partnerCode: string): Promise<InsuranceProfileRow | null> {
    const result = await this.database.query<InsuranceProfileRow>(`
      SELECT id::text, pet_id::text, insurer_code, policy_reference_masked,
             pet_relation, valid_from::text, valid_until::text,
             verification_state, consent_version, consented_at,
             consent_revoked_at, provider_data_masked, version, created_at, updated_at
      FROM insurance_schema.insurance_profiles
      WHERE owner_id = $1::uuid
        AND pet_id = $2::uuid
        AND consent_revoked_at IS NULL
      ORDER BY CASE WHEN insurer_code = $3 THEN 0 ELSE 1 END,
               created_at DESC,
               id DESC
      LIMIT 1
    `, [ownerId, petId, partnerCode]);
    return result.rows[0] ?? null;
  }

  private async updateProfileVerification(
    profileId: string,
    verificationState: 'VERIFIED' | 'PENDING' | 'REJECTED' | 'EXPIRED',
    providerDataMasked: Record<string, unknown>,
  ): Promise<void> {
    await this.database.query(`
      UPDATE insurance_schema.insurance_profiles
      SET verification_state = $2,
          provider_data_masked = $3::jsonb,
          version = version + 1,
          updated_at = clock_timestamp()
      WHERE id = $1::uuid
    `, [profileId, verificationState, JSON.stringify(maskProviderData(providerDataMasked))]);
  }

  private async storeProviderResult(
    id: string,
    state: CoverageCheckState,
    input: {
      providerReference: string;
      responseSummary: Record<string, unknown>;
      providerCheckedAt: Date;
      coverageValidUntil: Date | null;
      claimDraft: Record<string, unknown> | null;
    },
  ): Promise<CoverageCheckView> {
    return this.database.withTransaction(async (client) => {
      await client.query("SET LOCAL lock_timeout = '50ms'");
      await client.query("SET LOCAL statement_timeout = '500ms'");
      const result = await client.query<CoverageCheckRow>(`
        UPDATE insurance_schema.coverage_checks
        SET state = $2,
            provider_reference = $3,
            response_summary_json = $4::jsonb,
            provider_checked_at = $5::timestamptz,
            coverage_valid_until = $6::timestamptz,
            claim_draft_json = $7::jsonb,
            version = version + 1,
            updated_at = clock_timestamp()
        WHERE id = $1::uuid
          AND state = 'PROCESSING'
        RETURNING id::text, owner_id::text, pet_id::text, partner_code, state,
          consent_version, provider_reference, response_summary_json,
          provider_checked_at, coverage_valid_until, claim_draft_json, version,
          clock_timestamp() AS server_now
      `, [
        id,
        state,
        input.providerReference,
        JSON.stringify(safeProviderSummary(input.responseSummary)),
        input.providerCheckedAt.toISOString(),
        input.coverageValidUntil?.toISOString() ?? null,
        JSON.stringify(input.claimDraft ?? {}),
      ]);
      const row = result.rows[0];
      if (!row) return this.readInternal(id);
      await client.query(`
        INSERT INTO booking_schema.outbox_events (
          event_type, aggregate_type, aggregate_id, aggregate_version, correlation_id,
          causation_id, traceparent, payload_json, deduplication_key
        ) VALUES (
          'insurance.coverage.updated.v1', 'insurance_coverage_check', $1::uuid, $2, $3::uuid,
          $4::uuid, $5, $6::jsonb, $7
        )
        ON CONFLICT (deduplication_key) DO NOTHING
      `, [
        row.id,
        row.version,
        this.traceContext.getCorrelationId() ?? null,
        this.traceContext.getCausationId() ?? null,
        this.traceContext.getTraceparent() ?? null,
        JSON.stringify({
          coverageCheckId: row.id,
          ownerId: row.owner_id,
          petId: row.pet_id,
          partnerCode: row.partner_code,
          state: row.state,
          providerReference: row.provider_reference,
        }),
        `insurance.coverage.updated.v1:${row.id}:${row.version}`,
      ]);
      return this.view(row);
    });
  }

  private async readInternal(id: string): Promise<CoverageCheckView> {
    const result = await this.database.query<CoverageCheckRow>(`
      SELECT id::text, owner_id::text, pet_id::text, partner_code, state,
             consent_version, provider_reference, response_summary_json,
             provider_checked_at, coverage_valid_until, claim_draft_json,
             version, clock_timestamp() AS server_now
      FROM insurance_schema.coverage_checks
      WHERE id = $1::uuid
    `, [id]);
    if (!result.rows[0]) {
      throw new DomainException(HttpStatus.NOT_FOUND, 'INSURANCE_COVERAGE_CHECK_NOT_FOUND', 'Coverage check not found');
    }
    return this.view(result.rows[0]);
  }

  private view(row: CoverageCheckRow): CoverageCheckView {
    return {
      id: row.id,
      petId: row.pet_id,
      partnerCode: row.partner_code,
      state: row.state,
      consentVersion: row.consent_version,
      providerReference: row.provider_reference,
      responseSummary: row.response_summary_json ?? {},
      providerCheckedAt: row.provider_checked_at?.toISOString() ?? null,
      coverageValidUntil: row.coverage_valid_until?.toISOString() ?? null,
      claimDraft: claimDraftView(row.claim_draft_json),
      version: row.version,
      serverNow: row.server_now.toISOString(),
    };
  }
}

interface CoverageCheckRow {
  id: string;
  owner_id: string;
  pet_id: string;
  partner_code: string;
  state: CoverageCheckState;
  consent_version: string | null;
  provider_reference: string | null;
  response_summary_json: Record<string, unknown>;
  provider_checked_at: Date | null;
  coverage_valid_until: Date | null;
  claim_draft_json: Record<string, unknown>;
  version: number;
  server_now: Date;
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
  consent_revoked_at: Date | null;
  provider_data_masked: Record<string, unknown>;
  version: number;
  created_at: Date;
  updated_at: Date;
}

interface PreparedCoverageRequest {
  row: CoverageCheckRow;
  profile: InsuranceProfileRow | null;
  providerReference: string;
  request: {
    coverageCheckId: string;
    ownerId: string;
    petId: string;
    partnerCode: string;
    consentVersion: string;
    policy: InsuranceProviderPolicySummary | null;
  };
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
    consentRevokedAt: row.consent_revoked_at?.toISOString() ?? null,
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

function safeProviderSummary(input: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (
      typeof value === 'string'
      || typeof value === 'number'
      || typeof value === 'boolean'
      || value === null
    ) {
      result[key] = value;
    }
  }
  return result;
}

function policySummary(row: InsuranceProfileRow): InsuranceProviderPolicySummary {
  return {
    insurerCode: row.insurer_code,
    policyReferenceMasked: row.policy_reference_masked,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    verificationState: row.verification_state,
  };
}

function claimDraftView(input: Record<string, unknown> | null): ClaimDraftView | null {
  if (!input || Object.keys(input).length === 0) return null;
  const requiredDocuments = Array.isArray(input.requiredDocuments)
    ? input.requiredDocuments.filter((value): value is string => typeof value === 'string')
    : [];
  if (
    typeof input.draftId !== 'string'
    || typeof input.partnerCode !== 'string'
    || typeof input.status !== 'string'
    || typeof input.createdAt !== 'string'
    || typeof input.expiresAt !== 'string'
  ) {
    return null;
  }
  return {
    draftId: input.draftId,
    partnerCode: input.partnerCode,
    status: input.status,
    requiredDocuments,
    createdAt: input.createdAt,
    expiresAt: input.expiresAt,
  };
}
