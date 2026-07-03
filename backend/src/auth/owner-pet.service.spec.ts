import { BadRequestException, NotFoundException } from '@nestjs/common';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import type { DatabaseService } from '../database/database.service';
import type { JwtPayload } from './auth.types';
import type { UploadedPetFile } from './owner-pet.service';

process.env.JWT_SECRET ??= 'test-secret';
process.env.JWT_ISSUER ??= 'vethelp-test';
process.env.JWT_AUDIENCE ??= 'vethelp-api-test';
process.env.WORKER_SERVICE_TOKEN ??= 'worker-test-token';
process.env.DATABASE_URL ??= 'postgres://localhost:5432/vethelp_test';

const { Role } = require('./auth.types') as typeof import('./auth.types');
const { OwnerPetService, PET_DOCUMENT_MAX_BYTES } = require('./owner-pet.service') as typeof import('./owner-pet.service');

describe('OwnerPetService document uploads', () => {
  let previousStorageDir: string | undefined;
  let storageDir: string;

  beforeEach(async () => {
    previousStorageDir = process.env.PET_DOCUMENT_STORAGE_DIR;
    storageDir = await mkdtemp(path.join(os.tmpdir(), 'vethelp-pet-documents-'));
    process.env.PET_DOCUMENT_STORAGE_DIR = storageDir;
  });

  afterEach(async () => {
    if (previousStorageDir === undefined) {
      delete process.env.PET_DOCUMENT_STORAGE_DIR;
    } else {
      process.env.PET_DOCUMENT_STORAGE_DIR = previousStorageDir;
    }
    await rm(storageDir, { recursive: true, force: true });
  });

  it('stores multipart document metadata and file bytes for the owning pet', async () => {
    const database = new FakePetDatabase();
    const service = new OwnerPetService(database.asDatabase());

    const upload = await service.uploadDocumentFile(owner(), 'pet-1', pdfFile(), 'HISTORY');

    expect(upload.petId).toBe('pet-1');
    expect(upload.docType).toBe('HISTORY');
    expect(upload.status).toBe('PROCESSED');
    expect(upload.fileUrl).toContain('/v1/owner/pets/pet-1/documents/');
    expect(database.insertedDocument?.file_name).toBe('lab.pdf');
    expect(database.insertedDocument?.mime_type).toBe('application/pdf');
    expect(database.insertedDocument?.file_size_bytes).toBe(4);
    expect(database.auditActions).toContain('pet.document.uploaded');

    const storedOwnerDirs = await readdir(storageDir);
    expect(storedOwnerDirs).toEqual(['owner-1']);
  });

  it('rejects upload for a foreign pet before storing bytes', async () => {
    const database = new FakePetDatabase({ ownsPet: false });
    const service = new OwnerPetService(database.asDatabase());

    await expect(service.uploadDocumentFile(owner(), 'pet-foreign', pdfFile(), 'HISTORY')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(database.insertedDocument).toBeNull();
    await expect(readdir(storageDir)).resolves.toEqual([]);
  });

  it('rejects unsupported and oversized files with owner-facing API errors', async () => {
    const service = new OwnerPetService(new FakePetDatabase().asDatabase());

    await expect(
      service.uploadDocumentFile(owner(), 'pet-1', file('notes.txt', 'text/plain', 3), 'HISTORY'),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.uploadDocumentFile(owner(), 'pet-1', file('large.pdf', 'application/pdf', PET_DOCUMENT_MAX_BYTES + 1), 'HISTORY'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects delete when document is not owner-scoped', async () => {
    const database = new FakePetDatabase({ deleteRows: 0 });
    const service = new OwnerPetService(database.asDatabase());

    await expect(service.deleteDocument(owner(), 'pet-1', 'document-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(database.auditActions).toEqual([]);
  });
});

class FakePetDatabase {
  constructor(
    private readonly options: {
      ownsPet?: boolean;
      deleteRows?: number;
    } = {},
  ) {}

  insertedDocument: {
    id: string;
    pet_id: string;
    owner_id: string;
    file_url: string;
    doc_type: 'PASSPORT' | 'HISTORY';
    status: 'PROCESSED';
    file_name: string;
    mime_type: string;
    file_size_bytes: number;
    storage_key: string;
    created_at: Date;
  } | null = null;
  auditActions: string[] = [];

  asDatabase(): DatabaseService {
    return {
      query: jest.fn((text: string, values: readonly unknown[] = []) => this.query(text, values)),
      withTransaction: jest.fn(async <T>(work: (client: PoolClient) => Promise<T>) => {
        const client = {
          query: jest.fn((text: string, values: readonly unknown[] = []) => this.clientQuery(text, values)),
        } as unknown as PoolClient;
        return work(client);
      }),
    } as unknown as DatabaseService;
  }

  private async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values: readonly unknown[],
  ): Promise<QueryResult<T>> {
    if (text.includes('FROM pet_schema.pets')) {
      return result<T>(this.options.ownsPet === false ? [] : [{ id: values[0] }]);
    }
    return result<T>([]);
  }

  private async clientQuery<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values: readonly unknown[],
  ): Promise<QueryResult<T>> {
    if (text.includes('INSERT INTO pet_schema.pet_documents')) {
      this.insertedDocument = {
        id: values[0] as string,
        pet_id: values[1] as string,
        owner_id: values[2] as string,
        file_url: values[3] as string,
        doc_type: values[4] as 'PASSPORT' | 'HISTORY',
        status: 'PROCESSED',
        file_name: values[5] as string,
        mime_type: values[6] as string,
        file_size_bytes: values[7] as number,
        storage_key: values[8] as string,
        created_at: new Date('2026-07-02T12:00:00.000Z'),
      };
      return result<T>([this.insertedDocument]);
    }
    if (text.includes('INSERT INTO audit_schema.audit_log')) {
      this.auditActions.push(values[1] as string);
      return result<T>([]);
    }
    if (text.includes('UPDATE pet_schema.pet_documents')) {
      const rows = this.options.deleteRows === 0 ? [] : [{ id: values[0] }];
      return result<T>(rows);
    }
    return result<T>([]);
  }
}

function owner(): JwtPayload {
  return { sub: 'owner-1', roles: [Role.OWNER] };
}

function pdfFile(): UploadedPetFile {
  return file('lab.pdf', 'application/pdf', 4);
}

function file(originalname: string, mimetype: string, size: number): UploadedPetFile {
  return {
    originalname,
    mimetype,
    size,
    buffer: Buffer.alloc(size, 1),
  };
}

function result<T extends QueryResultRow>(rows: QueryResultRow[]): QueryResult<T> {
  return {
    rows: rows as T[],
    command: 'SELECT',
    rowCount: rows.length,
    oid: 0,
    fields: [],
  };
}
