import { HttpStatus, Injectable } from '@nestjs/common';
import { DomainException, DomainErrors } from '../../common/domain-error';
import { DatabaseService } from '../../database/database.service';

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

@Injectable()
export class InsuranceService {
  constructor(private readonly database: DatabaseService) {}

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
      return this.view(created.rows[0]);
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
