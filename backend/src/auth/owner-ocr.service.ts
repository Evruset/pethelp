import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { JwtPayload, Role } from './auth.types';
import { OcrExtraction, OcrSource } from './ocr-provider';

type SourceRow = { id: string; owner_id: string; pet_id: string; doc_type: 'PASSPORT' | 'HISTORY'; storage_key: string | null; file_size_bytes: number | null; created_at: Date };
type Job = { id: string; document_id: string; owner_id: string; pet_id: string; state: string; attempt_count: number; source_identity: string; source_snapshot: OcrSource; claim_token: string | null; error_code: string | null; lease_until: Date | null };
export type OcrClaim = Job & { claim_token: string };
export type OcrFailure = 'PROVIDER_FAILED' | 'INVALID_RESULT' | 'SOURCE_UNAVAILABLE' | 'SOURCE_CHANGED';
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

@Injectable()
export class OwnerOcrService {
  constructor(private readonly database: DatabaseService) {}

  private owner(owner: JwtPayload): void {
    if (!owner.roles.includes(Role.OWNER)) throw new ForbiddenException({ code: 'ROLE_FORBIDDEN', message: 'Owner role required.' });
  }
  private missing(): never { throw new NotFoundException({ code: 'OWNER_OCR_NOT_FOUND', message: 'OCR source or job was not found.' }); }

  private async source(client: PoolClient, ownerId: string, petId: string, documentId: string): Promise<SourceRow | undefined> {
    // Lock order: job (if existing) -> Pet -> Document. No sharing locks or grants are changed.
    const pet = await client.query(`SELECT id FROM pet_schema.pets WHERE id=$1 AND owner_id=$2 AND archived_at IS NULL FOR SHARE`, [petId, ownerId]);
    if (!pet.rowCount) return undefined;
    const doc = await client.query<SourceRow>(`SELECT id,owner_id,pet_id,doc_type,storage_key,file_size_bytes,created_at
      FROM pet_schema.pet_documents WHERE id=$1 AND pet_id=$2 AND owner_id=$3
      AND deleted_at IS NULL AND doc_type IN('PASSPORT','HISTORY') FOR SHARE`, [documentId, petId, ownerId]);
    return doc.rows[0];
  }
  private fingerprint(source: SourceRow): string {
    return hash([source.id, source.owner_id, source.pet_id, source.doc_type, source.storage_key, source.file_size_bytes, source.created_at.toISOString()]);
  }

  async enqueue(owner: JwtPayload, petId: string, documentId: string) {
    this.owner(owner);
    return this.database.withTransaction(async client => {
      const source = await this.source(client, owner.sub, petId, documentId);
      if (!source) this.missing();
      await client.query(`INSERT INTO pet_schema.ocr_jobs(document_id,owner_id,pet_id,source_identity,source_snapshot)
        VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(document_id) DO NOTHING`,
      [documentId, owner.sub, petId, this.fingerprint(source), JSON.stringify({ documentId, documentType: source.doc_type })]);
      const job = await client.query<Job>(`SELECT * FROM pet_schema.ocr_jobs WHERE document_id=$1 AND owner_id=$2 AND pet_id=$3`, [documentId, owner.sub, petId]);
      if (!job.rows[0]) this.missing();
      return this.presentJob(job.rows[0]);
    });
  }

  async read(owner: JwtPayload, petId: string, documentId: string) {
    this.owner(owner);
    return this.database.withTransaction(async client => {
      const job = (await client.query<Job>(`SELECT * FROM pet_schema.ocr_jobs WHERE document_id=$1 AND owner_id=$2 AND pet_id=$3 FOR SHARE`, [documentId, owner.sub, petId])).rows[0];
      if (!job || !await this.source(client, owner.sub, petId, documentId)) this.missing();
      const result = (await client.query(`SELECT r.id,r.extraction,r.result_identity,r.extracted_at,a.provider_identity,a.provider_version,a.started_at,a.finished_at,
        c.id candidate_id,c.extracted_text,c.schema_version,c.kind,COALESCE(review.review_state,c.review_state) review_state FROM pet_schema.ocr_results r
        JOIN pet_schema.ocr_attempts a ON a.id=r.attempt_id JOIN pet_schema.ocr_candidates c ON c.result_id=r.id LEFT JOIN LATERAL (SELECT review_state FROM pet_schema.ocr_review_revisions WHERE candidate_id=c.id ORDER BY revision DESC LIMIT 1) review ON true WHERE r.job_id=$1`, [job.id])).rows[0];
      const attempts = (await client.query(`SELECT attempt_number AS "attemptNumber",status,started_at AS "startedAt",finished_at AS "finishedAt",error_code AS "errorCode"
        FROM pet_schema.ocr_attempts WHERE job_id=$1 ORDER BY attempt_number`, [job.id])).rows;
      return { ...this.presentJob(job), attempts, result: result ? {
        resultId: result.id, sourceIdentity: job.source_identity, resultIdentity: result.result_identity,
        authority: 'UNCONFIRMED', extraction: result.extraction, extractedAt: result.extracted_at,
        provider: result.provider_identity, providerVersion: result.provider_version,
        startedAt: result.started_at, finishedAt: result.finished_at,
        candidate: { candidateId: result.candidate_id, schemaVersion: result.schema_version, kind: result.kind, text: result.extracted_text, reviewState: result.review_state },
      } : null };
    });
  }

  async retry(owner: JwtPayload, petId: string, documentId: string) {
    this.owner(owner);
    return this.database.withTransaction(async client => {
      const job = (await client.query<Job>(`SELECT * FROM pet_schema.ocr_jobs WHERE document_id=$1 AND owner_id=$2 AND pet_id=$3 FOR UPDATE`, [documentId, owner.sub, petId])).rows[0];
      const source = await this.source(client, owner.sub, petId, documentId);
      if (!job || !source) this.missing();
      if (this.fingerprint(source) !== job.source_identity) throw new ConflictException({ code: 'OCR_SOURCE_CHANGED', message: 'OCR source changed.' });
      if (job.state !== 'FAILED' || job.attempt_count >= 3) throw new ConflictException({ code: 'OCR_RETRY_UNAVAILABLE', message: 'Retry is unavailable.' });
      const next = await client.query<Job>(`UPDATE pet_schema.ocr_jobs SET state='QUEUED',error_code=NULL,available_at=clock_timestamp(),updated_at=clock_timestamp() WHERE id=$1 RETURNING *`, [job.id]);
      return this.presentJob(next.rows[0]);
    });
  }

  async claim(): Promise<OcrClaim | null> {
    return this.database.withTransaction(async client => {
      // One bounded recovery/claim per poll. SKIP LOCKED enables independent workers.
      const job = (await client.query<Job>(`SELECT * FROM pet_schema.ocr_jobs WHERE
        (state='QUEUED' AND available_at<=clock_timestamp()) OR (state='RUNNING' AND lease_until<=clock_timestamp())
        ORDER BY available_at,created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED`)).rows[0];
      if (!job) return null;
      if (job.state === 'RUNNING') {
        await client.query(`UPDATE pet_schema.ocr_attempts SET status='ABANDONED',finished_at=clock_timestamp(),error_code='LEASE_EXPIRED' WHERE id=$1 AND status='RUNNING'`, [job.claim_token]);
        if (job.attempt_count >= 3) {
          await client.query(`UPDATE pet_schema.ocr_jobs SET state='FAILED',claim_token=NULL,lease_until=NULL,error_code='LEASE_EXPIRED',updated_at=clock_timestamp() WHERE id=$1`, [job.id]);
          return null;
        }
      }
      const source = await this.source(client, job.owner_id, job.pet_id, job.document_id);
      if (!source || this.fingerprint(source) !== job.source_identity) {
        await client.query(`UPDATE pet_schema.ocr_jobs SET state='FAILED',claim_token=NULL,lease_until=NULL,error_code=$2,updated_at=clock_timestamp() WHERE id=$1`, [job.id, source ? 'SOURCE_CHANGED' : 'SOURCE_UNAVAILABLE']);
        return null;
      }
      const token = randomUUID();
      const claimed = await client.query<OcrClaim>(`UPDATE pet_schema.ocr_jobs SET state='RUNNING',attempt_count=attempt_count+1,
        claim_token=$2,lease_until=clock_timestamp()+interval '60 seconds',error_code=NULL,updated_at=clock_timestamp() WHERE id=$1 RETURNING *`, [job.id, token]);
      await client.query(`INSERT INTO pet_schema.ocr_attempts(id,job_id,attempt_number,status) VALUES($1,$2,$3,'RUNNING')`, [token, job.id, claimed.rows[0].attempt_count]);
      return claimed.rows[0];
    });
  }

  async finish(claim: OcrClaim, extraction?: OcrExtraction, failure?: OcrFailure): Promise<boolean> {
    let serialized: string | undefined;
    if (!failure) {
      try { serialized = this.validate(extraction); } catch { failure = 'INVALID_RESULT'; }
    }
    return this.database.withTransaction(async client => {
      const job = (await client.query<Job>(`SELECT * FROM pet_schema.ocr_jobs WHERE id=$1 AND lease_until>clock_timestamp() FOR UPDATE`, [claim.id])).rows[0];
      // Lease/token fencing prevents late provider responses and duplicate replay from writing.
      if (!job || job.state !== 'RUNNING' || job.claim_token !== claim.claim_token) return false;
      const source = await this.source(client, job.owner_id, job.pet_id, job.document_id);
      if (!source) failure = 'SOURCE_UNAVAILABLE';
      else if (this.fingerprint(source) !== job.source_identity) failure = 'SOURCE_CHANGED';
      if (failure) {
        await client.query(`UPDATE pet_schema.ocr_attempts SET status='FAILED',finished_at=clock_timestamp(),error_code=$2 WHERE id=$1`, [claim.claim_token, failure]);
        const again = failure === 'PROVIDER_FAILED' && job.attempt_count < 3;
        await client.query(`UPDATE pet_schema.ocr_jobs SET state=$2,claim_token=NULL,lease_until=NULL,error_code=$3,
          available_at=clock_timestamp()+($4::integer * interval '5 seconds'),updated_at=clock_timestamp() WHERE id=$1`, [job.id, again ? 'QUEUED' : 'FAILED', failure, job.attempt_count]);
      } else {
        const value = JSON.parse(serialized!) as OcrExtraction;
        await client.query(`UPDATE pet_schema.ocr_attempts SET status='SUCCEEDED',finished_at=clock_timestamp(),provider_identity=$2,provider_version=$3 WHERE id=$1`, [claim.claim_token, value.provider ?? null, value.providerVersion ?? null]);
        const result = await client.query(`INSERT INTO pet_schema.ocr_results(job_id,attempt_id,document_id,owner_id,pet_id,source_identity,result_identity,extraction)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb) RETURNING id`, [job.id, claim.claim_token, job.document_id, job.owner_id, job.pet_id, job.source_identity, hash(value), serialized]);
        await client.query(`INSERT INTO pet_schema.ocr_candidates(result_id,job_id,extracted_text) VALUES($1,$2,$3)`, [result.rows[0].id, job.id, value.text]);
        await client.query(`UPDATE pet_schema.ocr_jobs SET state='SUCCEEDED',claim_token=NULL,lease_until=NULL,error_code=NULL,updated_at=clock_timestamp() WHERE id=$1`, [job.id]);
      }
      return true;
    });
  }

  private validate(value: unknown): string {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException();
    const v = value as Record<string, unknown>;
    if (Object.keys(v).some(key => !['text','provider','providerVersion'].includes(key)) || typeof v.text !== 'string' || !v.text.trim() || v.text.includes('\u0000') || Buffer.byteLength(v.text, 'utf8') > 32768) throw new BadRequestException();
    for (const [key, limit] of [['provider',120],['providerVersion',80]] as const) {
      if (v[key] !== undefined && (typeof v[key] !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(v[key] as string) || (v[key] as string).length > limit)) throw new BadRequestException();
    }
    const serialized = JSON.stringify(value);
    if (Buffer.byteLength(serialized, 'utf8') > 65000) throw new BadRequestException();
    return serialized;
  }
  private presentJob(job: Job) {
    return { jobId: job.id, documentId: job.document_id, petId: job.pet_id, state: job.state, attemptCount: job.attempt_count, maxAttempts: 3, errorCode: job.error_code, authority: 'UNCONFIRMED' };
  }
}
