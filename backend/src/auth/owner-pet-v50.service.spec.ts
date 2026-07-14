import { NotFoundException, PreconditionFailedException } from '@nestjs/common';
import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import type { DatabaseService } from '../database/database.service';
import { Role, type JwtPayload } from './auth.types';
import { OwnerPetService } from './owner-pet.service';

describe('OwnerPetService V50 archive and diary contract', () => {
  it('archives atomically with owner scope, If-Match, version increment and audit', async () => {
    const database = new V50Database({ pet: petRow() });
    const pet = await new OwnerPetService(database.asDatabase()).setArchived(owner(), PET_ID, true, 4);
    expect(pet.isArchived).toBe(true);
    expect(pet.profileVersion).toBe(5);
    expect(pet).not.toHaveProperty('medicalHistoryOcr');
    expect(database.auditActions).toEqual(['pet.archived']);
    expect(database.archiveValues).toEqual([PET_ID, OWNER_ID, true, 4]);
  });

  it('restores an archived pet with the same atomic owner/version contract', async () => {
    const database = new V50Database({ pet: { ...petRow(), archived_at: new Date('2026-07-14T12:00:00.000Z') } });
    const pet = await new OwnerPetService(database.asDatabase()).setArchived(owner(), PET_ID, false, 4);
    expect(pet.isArchived).toBe(false);
    expect(database.auditActions).toEqual(['pet.restored']);
    expect(database.archiveValues).toEqual([PET_ID, OWNER_ID, false, 4]);
  });

  it('does not advance version or audit when archive state already matches', async () => {
    const database = new V50Database({
      pet: { ...petRow(), archived_at: new Date('2026-07-14T12:00:00.000Z') },
    });
    const pet = await new OwnerPetService(database.asDatabase()).setArchived(
      owner(), PET_ID, true, 4,
    );
    expect(pet.profileVersion).toBe(4);
    expect(database.archiveValues).toBeNull();
    expect(database.auditActions).toEqual([]);
  });

  it('uses active-only owner list by default and can explicitly include archived pets', async () => {
    const database = new V50Database({ pet: petRow() });
    const service = new OwnerPetService(database.asDatabase());
    await service.list(owner());
    expect(database.lastPetSql).toContain('($2::boolean OR archived_at IS NULL)');
    expect(database.lastPetValues).toEqual([OWNER_ID, false]);
    await service.list(owner(), true);
    expect(database.lastPetValues).toEqual([OWNER_ID, true]);
  });

  it('normalizes foreign archive to 404 without leaking current version', async () => {
    const service = new OwnerPetService(new V50Database({ pet: null }).asDatabase());
    await expect(service.setArchived(owner(), PET_ID, true, 4)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('normalizes foreign profile and diary deep links to the same pet 404', async () => {
    const service = new OwnerPetService(new V50Database({ pet: null }).asDatabase());
    await expect(service.read(owner(), PET_ID)).resolves.toBeUndefined();
    await expect(service.diary(owner(), PET_ID, 20, 0)).rejects.toMatchObject({
      response: { code: 'OWNER_PET_NOT_FOUND' },
    });
  });

  it('allows an owned archived profile and diary as controlled read-only history', async () => {
    const archived = { ...petRow(), archived_at: new Date('2026-07-14T12:00:00.000Z') };
    const service = new OwnerPetService(new V50Database({ pet: archived, diary: [] }).asDatabase());
    await expect(service.read(owner(), PET_ID)).resolves.toMatchObject({ isArchived: true });
    await expect(service.diary(owner(), PET_ID, 20, 0)).resolves.toMatchObject({ petId: PET_ID });
  });

  it('rejects missing and stale If-Match without applying archive', async () => {
    const database = new V50Database({ pet: petRow() });
    const service = new OwnerPetService(database.asDatabase());
    await expect(service.setArchived(owner(), PET_ID, true)).rejects.toMatchObject({ response: { code: 'PET_PROFILE_VERSION_REQUIRED' } });
    await expect(service.setArchived(owner(), PET_ID, true, 3)).rejects.toBeInstanceOf(PreconditionFailedException);
    expect(database.archiveValues).toBeNull();
  });

  it('returns server-sorted, bounded diary presentation and maps only persisted document states', async () => {
    const database = new V50Database({
      pet: petRow(),
      diary: [
        diaryRow('DOCUMENT', 'document-1', '2026-07-14T12:00:00.000Z', 'READY', '/v1/owner/pets/p/documents/d/download'),
        diaryRow('VISIT', 'visit-1', '2026-07-13T12:00:00.000Z', 'CONFIRMED', null),
        diaryRow('TELEMED', 'telemed-1', '2026-07-12T12:00:00.000Z', 'COMPLETED', null),
      ],
    });
    const page = await new OwnerPetService(database.asDatabase()).diary(owner(), PET_ID, 3, 0);
    expect(page.entries.map((entry) => entry.type)).toEqual(['DOCUMENT', 'VISIT', 'TELEMED']);
    expect(page.entries[0]).toMatchObject({ lifecycleStatus: 'READY', sourceId: 'document-1' });
    expect(page.entries[1].lifecycleStatus).toBe('VISIT_TIME_PASSED');
    expect(page.entries[2].lifecycleStatus).toBe('COMPLETED');
    expect(page.entries[0]).not.toHaveProperty('storageKey');
    expect(page.entries[0]).not.toHaveProperty('medicalHistoryOcr');
    expect(page.page).toEqual({ limit: 3, offset: 0, nextOffset: null, total: 3 });
    expect(database.diarySql).toContain('ORDER BY occurred_at DESC, type_rank ASC, source_id ASC');
    expect(database.diaryValues).toEqual([OWNER_ID, PET_ID, 3, 0]);
  });

  it('returns allowlisted document metadata and normalizes foreign documents to 404', async () => {
    const owned = new V50Database({ pet: petRow(), document: documentRow() });
    const metadata = await new OwnerPetService(owned.asDatabase()).documentMetadata(owner(), PET_ID, DOCUMENT_ID);
    expect(metadata).toEqual({
      id: DOCUMENT_ID, petId: PET_ID, type: 'HISTORY', fileName: 'lab.pdf', mimeType: 'application/pdf',
      sizeBytes: 42, lifecycleStatus: 'PROCESSING', createdAt: '2026-07-14T10:00:00.000Z', canDownload: true,
      downloadUrl: `/v1/owner/pets/${PET_ID}/documents/${DOCUMENT_ID}/download`,
    });
    expect(JSON.stringify(metadata)).not.toContain('storage/owner');
    expect(owned.documentAuditActions).toEqual(['pet.document.metadata.read']);
    await expect(new OwnerPetService(new V50Database({ pet: petRow() }).asDatabase())
      .documentMetadata(owner(), PET_ID, DOCUMENT_ID)).rejects.toMatchObject({ response: { code: 'OWNER_PET_DOCUMENT_NOT_FOUND' } });
  });

  it.each([
    ['PROCESSING', 'PROCESSING'],
    ['PROCESSED', 'READY'],
    ['FAILED', 'FAILED'],
  ])('maps persisted document state %s without inventing review state', async (persisted, expected) => {
    const database = new V50Database({ pet: petRow(), document: { ...documentRow(), status: persisted } });
    const metadata = await new OwnerPetService(database.asDatabase())
      .documentMetadata(owner(), PET_ID, DOCUMENT_ID);
    expect(metadata.lifecycleStatus).toBe(expected);
    expect(metadata.lifecycleStatus).not.toBe('REVIEW_REQUIRED');
  });
});

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const PET_ID = '22222222-2222-4222-8222-222222222222';
const DOCUMENT_ID = '33333333-3333-4333-8333-333333333333';

class V50Database {
  auditActions: string[] = [];
  archiveValues: readonly unknown[] | null = null;
  diarySql = '';
  diaryValues: readonly unknown[] = [];
  lastPetSql = '';
  lastPetValues: readonly unknown[] = [];
  documentAuditActions: string[] = [];
  constructor(private readonly fixture: { pet: any | null; diary?: any[]; document?: any | null }) {}

  asDatabase(): DatabaseService {
    return {
      query: jest.fn((sql: string, values: readonly unknown[] = []) => this.query(sql, values)),
      withTransaction: jest.fn(async <T>(work: (client: PoolClient) => Promise<T>) => work({
        query: jest.fn((sql: string, values: readonly unknown[] = []) => this.transactionQuery(sql, values)),
      } as unknown as PoolClient)),
    } as unknown as DatabaseService;
  }

  private async query<T extends QueryResultRow>(sql: string, values: readonly unknown[]): Promise<QueryResult<T>> {
    if (sql.includes("'pet_document'")) {
      this.documentAuditActions.push(values[1] as string);
      return result<T>([]);
    }
    if (sql.includes('WITH diary AS')) {
      this.diarySql = sql; this.diaryValues = values;
      return result<T>(this.fixture.diary ?? []);
    }
    if (sql.includes('FROM pet_schema.pet_documents')) return result<T>(this.fixture.document ? [this.fixture.document] : []);
    if (sql.includes('FROM pet_schema.pets')) {
      this.lastPetSql = sql; this.lastPetValues = values;
      return result<T>(this.fixture.pet ? [this.fixture.pet] : []);
    }
    return result<T>([]);
  }

  private async transactionQuery<T extends QueryResultRow>(sql: string, values: readonly unknown[]): Promise<QueryResult<T>> {
    if (sql.includes('FOR UPDATE')) return result<T>(this.fixture.pet ? [this.fixture.pet] : []);
    if (sql.includes('UPDATE pet_schema.pets')) {
      this.archiveValues = values;
      return result<T>([{ ...this.fixture.pet, archived_at: values[2] ? new Date('2026-07-14T13:00:00.000Z') : null, profile_version: 5 }]);
    }
    if (sql.includes('INSERT INTO audit_schema.audit_log')) this.auditActions.push(values[1] as string);
    return result<T>([]);
  }
}

function owner(): JwtPayload { return { sub: OWNER_ID, roles: [Role.OWNER] }; }
function petRow() {
  return { id: PET_ID, name: 'Луна', species: 'CAT', breed: null, birth_date: null, age_months: null,
    sex: null, gender: null, weight_kg: null, sterilized: null, is_sterilized: null, chip_number: null,
    allergies: [], chronic_conditions: [], vaccination_notes: null, photo_url: null, insurance_policy_links: [],
    medical_history_ocr: null, profile_version: 4, archived_at: null,
    created_at: new Date('2026-01-01T00:00:00.000Z'), updated_at: new Date('2026-01-01T00:00:00.000Z') };
}
function diaryRow(type: string, id: string, occurredAt: string, status: string, downloadUrl: string | null) {
  return { entry_type: type, source_id: id, occurred_at: new Date(occurredAt), ends_at: null, title: type,
    summary: null, lifecycle_status: status, download_url: downloadUrl, total_count: '3' };
}
function documentRow() {
  return { id: DOCUMENT_ID, pet_id: PET_ID, owner_id: OWNER_ID, file_url: 'internal', doc_type: 'HISTORY',
    status: 'PROCESSING', file_name: 'lab.pdf', mime_type: 'application/pdf', file_size_bytes: 42,
    storage_key: 'storage/owner/lab.pdf', created_at: new Date('2026-07-14T10:00:00.000Z') };
}
function result<T extends QueryResultRow>(rows: QueryResultRow[]): QueryResult<T> {
  return { rows: rows as T[], command: 'SELECT', rowCount: rows.length, oid: 0, fields: [] };
}
