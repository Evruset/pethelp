import { BadRequestException, Injectable, NotFoundException, PreconditionFailedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ReadStream } from 'node:fs';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { JwtPayload } from './auth.types';
import { CreateOwnerPetDto, UpdateOwnerPetDto } from './dto/owner-pet.dto';
import { ownerAppointmentPresentation, OwnerAppointmentPresentation } from './owner-appointments.service';

export const PET_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_DOCUMENT_MIME_TYPES = new Map<string, string>([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/heic', '.heic'],
  ['image/heif', '.heif'],
  ['image/webp', '.webp'],
  ['application/pdf', '.pdf'],
]);

const ALLOWED_PHOTO_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp']);

export type UploadedPetFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
};

export type OwnerPet = {
  id: string;
  name: string;
  species: 'DOG' | 'CAT' | 'OTHER';
  breed: string | null;
  birthDate: string | null;
  ageMonths: number | null;
  sex: 'MALE' | 'FEMALE' | 'UNKNOWN' | null;
  gender: 'MALE' | 'FEMALE' | null;
  weightKg: string | null;
  sterilized: boolean | null;
  isSterilized: boolean | null;
  chipNumber: string | null;
  allergies: string[];
  chronicConditions: string[];
  vaccinationNotes: string | null;
  photoUrl: string | null;
  insurancePolicyLinks: string[];
  profileVersion: number;
  archivedAt?: string | null;
  isArchived?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type OwnerPetCareDocument = {
  id: string;
  type: 'PASSPORT' | 'HISTORY';
  label: string;
  value: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  downloadUrl: string;
  canOpen: boolean;
  canDelete: boolean;
  isImage: boolean;
};

export type OwnerPetDocumentUpload = {
  documentId: string;
  petId: string;
  fileUrl: string;
  docType: 'PASSPORT' | 'HISTORY';
  status: 'PROCESSING' | 'PROCESSED' | 'FAILED';
  createdAt: string;
};

export type OwnerPetDocumentDownload = {
  stream: ReadStream;
  safeFileName: string;
  mimeType: string;
  fileSizeBytes: number;
};

export type OwnerPetCareVisit = {
  holdId: string;
  appointmentId: string | null;
  state: string;
  bucket: 'ACTIVE' | 'HISTORY';
  presentation: OwnerAppointmentPresentation;
  clinicalSummary: string | null;
  startsAt: string;
  endsAt: string;
  clinic: { id: string; name: string; address: string };
  service: {
    id: string | null;
    code: string | null;
    name: string | null;
    priceAmount: string | null;
    currency: string | null;
  };
};

export type OwnerPetCareTelemedSession = {
  sessionId: string;
  bookingHoldId: string | null;
  state: string;
  bucket: 'ACTIVE' | 'HISTORY';
  startsAt: string;
  endsAt: string;
  doctorJoinDeadlineAt: string;
  clinic: { id: string; name: string; address: string };
  service: { id: string | null; name: string | null };
};

export type OwnerPetCareSummary = {
  pet: OwnerPet;
  documents: OwnerPetCareDocument[];
  visits: OwnerPetCareVisit[];
  telemedSessions: OwnerPetCareTelemedSession[];
  serverNow: string;
};

export type OwnerPetDiaryEntry = {
  type: 'DOCUMENT' | 'VISIT' | 'TELEMED';
  sourceId: string;
  occurredAt: string;
  endsAt: string | null;
  title: string;
  summary: string | null;
  lifecycleStatus: string;
  downloadUrl: string | null;
};

export type OwnerPetDiaryPage = {
  petId: string;
  entries: OwnerPetDiaryEntry[];
  page: { limit: number; offset: number; nextOffset: number | null; total: number };
};

type OwnerPetRow = {
  id: string;
  name: string;
  species: OwnerPet['species'];
  breed: string | null;
  birth_date: Date | string | null;
  age_months: number | null;
  sex: OwnerPet['sex'];
  gender: OwnerPet['gender'];
  weight_kg: string | null;
  sterilized: boolean | null;
  is_sterilized: boolean | null;
  chip_number: string | null;
  allergies: string[] | null;
  chronic_conditions: string[] | null;
  vaccination_notes: string | null;
  photo_url: string | null;
  insurance_policy_links: string[] | null;
  medical_history_ocr: Record<string, unknown> | null;
  profile_version: string | number;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type PetDocumentRow = {
  id: string;
  pet_id: string;
  owner_id: string;
  file_url: string;
  doc_type: 'PASSPORT' | 'HISTORY' | 'PET_PHOTO';
  status: 'PROCESSING' | 'PROCESSED' | 'FAILED';
  file_name: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  storage_key: string | null;
  created_at: Date;
};

@Injectable()
export class OwnerPetService {
  constructor(private readonly database: DatabaseService) {}

  async list(owner: JwtPayload, includeArchived = false): Promise<OwnerPet[]> {
    const result = await this.database.query<OwnerPetRow>(`
      SELECT
        id, name, species, breed, birth_date, age_months, sex, gender,
        weight_kg::text, sterilized, is_sterilized, chip_number,
        allergies, chronic_conditions, vaccination_notes, photo_url,
        insurance_policy_links, medical_history_ocr, profile_version, archived_at, created_at, updated_at
      FROM pet_schema.pets
      WHERE owner_id = $1::uuid AND ($2::boolean OR archived_at IS NULL)
      ORDER BY created_at ASC, id ASC
    `, [owner.sub, includeArchived]);
    return result.rows.map((row) => this.toPet(row));
  }

  async read(owner: JwtPayload, petId: string): Promise<OwnerPet | undefined> {
    const result = await this.database.query<OwnerPetRow>(`
      SELECT
        id, name, species, breed, birth_date, age_months, sex, gender,
        weight_kg::text, sterilized, is_sterilized, chip_number,
        allergies, chronic_conditions, vaccination_notes, photo_url,
        insurance_policy_links, medical_history_ocr, profile_version, archived_at, created_at, updated_at
      FROM pet_schema.pets
      WHERE id = $1::uuid AND owner_id = $2::uuid
      LIMIT 1
    `, [petId, owner.sub]);
    return result.rows[0] ? this.toPet(result.rows[0]) : undefined;
  }

  async readActiveCatalogContext(
    owner: JwtPayload,
    petId: string,
  ): Promise<{ id: string; species: OwnerPet['species'] } | undefined> {
    const result = await this.database.query<{
      id: string;
      species: OwnerPet['species'];
    }>(`
      SELECT id, species
      FROM pet_schema.pets
      WHERE id = $1::uuid
        AND owner_id = $2::uuid
        AND archived_at IS NULL
      LIMIT 1
    `, [petId, owner.sub]);
    return result.rows[0];
  }

  async careSummary(owner: JwtPayload, petId: string): Promise<OwnerPetCareSummary | undefined> {
    const pet = await this.read(owner, petId);
    if (!pet) return undefined;

    const visits = await this.database.query<{
      hold_id: string;
      appointment_id: string | null;
      state: string;
      bucket: 'ACTIVE' | 'HISTORY';
      starts_at: Date;
      ends_at: Date;
      clinic_id: string;
      clinic_name: string;
      address: string;
      service_id: string | null;
      service_code: string | null;
      service_name: string | null;
      price_amount: string | null;
      currency: string | null;
      clinical_summary: string | null;
    }>(`
      WITH server_time AS (SELECT clock_timestamp() AS value)
      SELECT
        hold.id AS hold_id,
        appointment.id AS appointment_id,
        hold.state AS state,
        CASE
          WHEN slot.ends_at <= server_time.value THEN 'HISTORY'
          WHEN hold.state IN (
            'MANUAL_CONFIRM_PENDING',
            'MIS_RESERVATION_PENDING',
            'MIS_RECONCILIATION_PENDING',
            'MIS_HELD',
            'ALTERNATIVE_PENDING',
            'CONFIRMED',
            'CANCELLATION_REQUESTED',
            'RESCHEDULE_REQUESTED'
          ) THEN 'ACTIVE'
          ELSE 'HISTORY'
        END AS bucket,
        slot.starts_at,
        slot.ends_at,
        clinic.id AS clinic_id,
        clinic.public_name AS clinic_name,
        location.address,
        service.id AS service_id,
        service.code AS service_code,
        service.display_name AS service_name,
        service.price_amount::text AS price_amount,
        service.currency,
        hold.clinical_summary
      FROM booking_schema.booking_holds hold
      JOIN clinic_schema.appointment_slots slot ON slot.id = hold.slot_id
      JOIN clinic_schema.clinic_locations location ON location.id = slot.clinic_location_id
      JOIN clinic_schema.clinics clinic ON clinic.id = location.clinic_id
      LEFT JOIN clinic_schema.clinic_services service ON service.id = slot.service_id
      LEFT JOIN booking_schema.appointments appointment ON appointment.hold_id = hold.id
      CROSS JOIN server_time
      WHERE hold.owner_id = $1::uuid
        AND hold.pet_id = $2::uuid
      ORDER BY slot.starts_at DESC, hold.created_at DESC
      LIMIT 30
    `, [owner.sub, petId]);

    const telemedSessions = await this.database.query<{
      session_id: string;
      booking_hold_id: string | null;
      state: string;
      bucket: 'ACTIVE' | 'HISTORY';
      starts_at: Date;
      ends_at: Date;
      expires_at: Date;
      clinic_id: string;
      clinic_name: string;
      address: string;
      service_id: string | null;
      service_name: string | null;
    }>(`
      SELECT
        session.id::text AS session_id,
        session.booking_hold_id::text AS booking_hold_id,
        session.state,
        CASE
          WHEN session.state IN ('WAITING_FOR_DOCTOR', 'CONNECTED') THEN 'ACTIVE'
          ELSE 'HISTORY'
        END AS bucket,
        slot.starts_at,
        slot.ends_at,
        session.expires_at,
        COALESCE(clinic.id::text, 'platform-telemed') AS clinic_id,
        COALESCE(clinic.public_name, 'VetHelp Telemed') AS clinic_name,
        COALESCE(location.address, 'Онлайн-консультация') AS address,
        service.id::text AS service_id,
        service.display_name AS service_name
      FROM telemed_schema.telemed_sessions session
      LEFT JOIN booking_schema.booking_holds hold ON hold.id = session.booking_hold_id
      LEFT JOIN telemed_schema.telemed_cases telemed_case ON telemed_case.id = session.telemed_case_id
      LEFT JOIN clinic_schema.appointment_slots slot ON slot.id = hold.slot_id
      LEFT JOIN clinic_schema.clinic_locations location ON location.id = slot.clinic_location_id
      LEFT JOIN clinic_schema.clinics clinic ON clinic.id = location.clinic_id
      LEFT JOIN clinic_schema.clinic_services service ON service.id = slot.service_id
      WHERE session.owner_id = $1::uuid
        AND COALESCE(hold.pet_id, telemed_case.pet_id) = $2::uuid
      ORDER BY
        CASE WHEN session.state IN ('WAITING_FOR_DOCTOR', 'CONNECTED') THEN 0 ELSE 1 END,
        session.created_at DESC
      LIMIT 30
    `, [owner.sub, petId]);

    const documents = await this.database.query<PetDocumentRow>(`
      SELECT
        id, pet_id, owner_id, file_url, doc_type, status,
        file_name, mime_type, file_size_bytes, storage_key, created_at
      FROM pet_schema.pet_documents
      WHERE pet_id = $1::uuid
        AND owner_id = $2::uuid
        AND deleted_at IS NULL
        AND doc_type IN ('PASSPORT', 'HISTORY')
      ORDER BY created_at DESC, id DESC
      LIMIT 100
    `, [petId, owner.sub]);

    const serverNow = await this.database.query<{ value: Date }>('SELECT clock_timestamp() AS value');
    return {
      pet,
      documents: documents.rows.map((row) => this.toCareDocument(row)),
      visits: visits.rows.map((row) => ({
        holdId: row.hold_id,
        appointmentId: row.appointment_id,
        state: row.state,
        bucket: row.bucket,
        presentation: ownerAppointmentPresentation(row.state, row.bucket),
        clinicalSummary: row.clinical_summary,
        startsAt: row.starts_at.toISOString(),
        endsAt: row.ends_at.toISOString(),
        clinic: {
          id: row.clinic_id,
          name: row.clinic_name,
          address: row.address,
        },
        service: {
          id: row.service_id,
          code: row.service_code,
          name: row.service_name,
          priceAmount: row.price_amount,
          currency: row.currency,
        },
      })),
      telemedSessions: telemedSessions.rows.map((row) => ({
        sessionId: row.session_id,
        bookingHoldId: row.booking_hold_id,
        state: row.state,
        bucket: row.bucket,
        startsAt: row.starts_at.toISOString(),
        endsAt: row.ends_at.toISOString(),
        doctorJoinDeadlineAt: row.expires_at.toISOString(),
        clinic: {
          id: row.clinic_id,
          name: row.clinic_name,
          address: row.address,
        },
        service: {
          id: row.service_id,
          name: row.service_name,
        },
      })),
      serverNow: serverNow.rows[0].value.toISOString(),
    };
  }

  async diary(owner: JwtPayload, petId: string, limit: number, offset: number): Promise<OwnerPetDiaryPage> {
    if (!await this.read(owner, petId)) {
      throw new NotFoundException({ code: 'OWNER_PET_NOT_FOUND', message: 'Pet was not found.' });
    }
    const result = await this.database.query<{
      entry_type: OwnerPetDiaryEntry['type']; source_id: string; occurred_at: Date; ends_at: Date | null;
      title: string; summary: string | null; lifecycle_status: string; download_url: string | null; total_count: string;
    }>(`
      WITH diary AS (
        SELECT 'DOCUMENT'::text AS entry_type, document.id::text AS source_id,
          document.created_at AS occurred_at, NULL::timestamptz AS ends_at,
          COALESCE(document.file_name, CASE WHEN document.doc_type = 'PASSPORT' THEN 'Документ питомца' ELSE 'Медицинский файл' END) AS title,
          NULL::text AS summary,
          CASE document.status WHEN 'PROCESSING' THEN 'PROCESSING' WHEN 'PROCESSED' THEN 'READY' ELSE 'FAILED' END AS lifecycle_status,
          CASE WHEN document.storage_key IS NULL THEN NULL ELSE '/v1/owner/pets/' || $2::text || '/documents/' || document.id::text || '/download' END AS download_url,
          1 AS type_rank
        FROM pet_schema.pet_documents document
        WHERE document.owner_id = $1::uuid AND document.pet_id = $2::uuid
          AND document.deleted_at IS NULL AND document.doc_type IN ('PASSPORT', 'HISTORY')
        UNION ALL
        SELECT 'VISIT', hold.id::text, slot.starts_at, slot.ends_at,
          COALESCE(service.display_name, 'Визит в клинику'), hold.clinical_summary,
          hold.state, NULL::text, 2
        FROM booking_schema.booking_holds hold
        JOIN clinic_schema.appointment_slots slot ON slot.id = hold.slot_id
        LEFT JOIN clinic_schema.clinic_services service ON service.id = slot.service_id
        WHERE hold.owner_id = $1::uuid AND hold.pet_id = $2::uuid
        UNION ALL
        SELECT 'TELEMED', session.id::text, COALESCE(slot.starts_at, session.created_at), slot.ends_at,
          COALESCE(service.display_name, 'Онлайн-консультация'), NULL::text,
          session.state, NULL::text, 3
        FROM telemed_schema.telemed_sessions session
        LEFT JOIN booking_schema.booking_holds hold ON hold.id = session.booking_hold_id
        LEFT JOIN telemed_schema.telemed_cases telemed_case ON telemed_case.id = session.telemed_case_id
        LEFT JOIN clinic_schema.appointment_slots slot ON slot.id = hold.slot_id
        LEFT JOIN clinic_schema.clinic_services service ON service.id = slot.service_id
        WHERE session.owner_id = $1::uuid AND COALESCE(hold.pet_id, telemed_case.pet_id) = $2::uuid
      )
      SELECT diary.*, count(*) OVER ()::text AS total_count
      FROM diary
      ORDER BY occurred_at DESC, type_rank ASC, source_id ASC
      LIMIT $3::integer OFFSET $4::integer
    `, [owner.sub, petId, limit, offset]);
    const total = Number(result.rows[0]?.total_count ?? 0);
    return {
      petId,
      entries: result.rows.map((row) => ({
        type: row.entry_type,
        sourceId: row.source_id,
        occurredAt: row.occurred_at.toISOString(),
        endsAt: row.ends_at?.toISOString() ?? null,
        title: row.title,
        summary: row.summary,
        lifecycleStatus: this.publicDiaryLifecycle(row.entry_type, row.lifecycle_status),
        downloadUrl: row.download_url,
      })),
      page: { limit, offset, nextOffset: offset + result.rows.length < total ? offset + result.rows.length : null, total },
    };
  }

  async documentMetadata(owner: JwtPayload, petId: string, documentId: string) {
    const row = await this.readOwnedDocument(owner, petId, documentId);
    await this.writeDocumentAccessAudit(owner.sub, petId, documentId, 'pet.document.metadata.read');
    return {
      id: row.id,
      petId: row.pet_id,
      type: row.doc_type === 'PET_PHOTO' ? 'HISTORY' : row.doc_type,
      fileName: row.file_name ?? this.documentLabel(row),
      mimeType: row.mime_type ?? 'application/octet-stream',
      sizeBytes: row.file_size_bytes ?? 0,
      lifecycleStatus: row.status === 'PROCESSED' ? 'READY' : row.status,
      createdAt: row.created_at.toISOString(),
      canDownload: Boolean(row.storage_key),
      downloadUrl: row.storage_key ? this.documentDownloadUrl(petId, documentId) : null,
    };
  }

  async setArchived(owner: JwtPayload, petId: string, archived: boolean, ifMatchVersion?: number): Promise<OwnerPet> {
    if (ifMatchVersion === undefined) {
      throw new PreconditionFailedException({ code: 'PET_PROFILE_VERSION_REQUIRED', message: 'If-Match is required.' });
    }
    return this.database.withTransaction(async (client) => {
      const currentResult = await client.query<OwnerPetRow>(`
        SELECT id, name, species, breed, birth_date, age_months, sex, gender,
          weight_kg::text, sterilized, is_sterilized, chip_number, allergies, chronic_conditions,
          vaccination_notes, photo_url, insurance_policy_links, medical_history_ocr,
          profile_version, archived_at, created_at, updated_at
        FROM pet_schema.pets WHERE id = $1::uuid AND owner_id = $2::uuid FOR UPDATE
      `, [petId, owner.sub]);
      const currentRow = currentResult.rows[0];
      if (!currentRow) throw new NotFoundException({ code: 'OWNER_PET_NOT_FOUND', message: 'Pet was not found.' });
      if (Number(currentRow.profile_version) !== ifMatchVersion) {
        throw new PreconditionFailedException({
          code: 'PET_PROFILE_VERSION_MISMATCH', message: 'Pet profile version does not match current server state.',
          currentVersion: Number(currentRow.profile_version),
        });
      }
      if (Boolean(currentRow.archived_at) === archived) {
        return this.toPet(currentRow);
      }
      const result = await client.query<OwnerPetRow>(`
        UPDATE pet_schema.pets
        SET archived_at = CASE WHEN $3::boolean THEN clock_timestamp() ELSE NULL END,
          profile_version = profile_version + 1, updated_at = clock_timestamp()
        WHERE id = $1::uuid AND owner_id = $2::uuid
          AND profile_version = $4::integer
          AND (($3::boolean AND archived_at IS NULL) OR (NOT $3::boolean AND archived_at IS NOT NULL))
        RETURNING id, name, species, breed, birth_date, age_months, sex, gender,
          weight_kg::text, sterilized, is_sterilized, chip_number, allergies, chronic_conditions,
          vaccination_notes, photo_url, insurance_policy_links, medical_history_ocr,
          profile_version, archived_at, created_at, updated_at
      `, [petId, owner.sub, archived, ifMatchVersion]);
      if (!result.rows[0]) {
        throw new PreconditionFailedException({
          code: 'PET_PROFILE_VERSION_MISMATCH', message: 'Pet profile changed during archive transition.',
        });
      }
      const pet = this.toPet(result.rows[0]);
      await this.writePetAudit(client, owner.sub, petId, archived ? 'pet.archived' : 'pet.restored', {
        previousProfileVersion: Number(currentRow.profile_version), profileVersion: pet.profileVersion,
      });
      return pet;
    });
  }

  async create(owner: JwtPayload, input: CreateOwnerPetDto): Promise<OwnerPet> {
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException({ code: 'INVALID_PET_NAME', message: 'name must not be blank.' });
    }
    return this.database.withTransaction(async (client) => {
      const result = await client.query<OwnerPetRow>(`
        INSERT INTO pet_schema.pets (
          owner_id, name, species, breed, birth_date, age_months, sex, gender,
          weight_kg, sterilized, is_sterilized, chip_number,
          allergies, chronic_conditions, vaccination_notes, photo_url, insurance_policy_links
        )
        VALUES (
          $1::uuid, $2, $3, $4, $5::date, $6::integer, $7, $8,
          $9::numeric, $10::boolean, $11::boolean, $12,
          $13::text[], $14::text[], $15, $16, $17::jsonb
        )
        RETURNING
          id, name, species, breed, birth_date, age_months, sex, gender,
          weight_kg::text, sterilized, is_sterilized, chip_number,
          allergies, chronic_conditions, vaccination_notes, photo_url,
          insurance_policy_links, medical_history_ocr, profile_version, archived_at, created_at, updated_at
      `, [
        owner.sub,
        name,
        input.species,
        this.blankToNull(input.breed),
        input.birthDate ?? null,
        input.ageMonths ?? null,
        input.sex ?? input.gender ?? null,
        input.gender ?? this.genderFromSex(input.sex),
        input.weightKg ?? null,
        input.sterilized ?? input.isSterilized ?? null,
        input.isSterilized ?? input.sterilized ?? null,
        this.blankToNull(input.chipNumber),
        this.cleanList(input.allergies),
        this.cleanList(input.chronicConditions),
        this.blankToNull(input.vaccinationNotes),
        this.blankToNull(input.photoUrl),
        JSON.stringify(this.cleanList(input.insurancePolicyLinks)),
      ]);
      const pet = this.toPet(result.rows[0]);
      await this.writePetAudit(client, owner.sub, pet.id, 'pet.created', {
        species: pet.species,
        profileVersion: pet.profileVersion,
      });
      return pet;
    });
  }

  async update(owner: JwtPayload, petId: string, input: UpdateOwnerPetDto, ifMatchVersion?: number): Promise<OwnerPet> {
    const current = await this.read(owner, petId);
    if (!current) {
      throw new NotFoundException({ code: 'OWNER_PET_NOT_FOUND', message: 'Pet was not found.' });
    }
    if (current.isArchived) {
      throw new BadRequestException({ code: 'OWNER_PET_ARCHIVED_READ_ONLY', message: 'Archived pet is read-only.' });
    }
    if (ifMatchVersion !== undefined && current.profileVersion !== ifMatchVersion) {
      throw new PreconditionFailedException({
        code: 'PET_PROFILE_VERSION_MISMATCH',
        message: 'Pet profile version does not match current server state.',
        currentVersion: current.profileVersion,
      });
    }

    const name = input.name === undefined ? current.name : input.name.trim();
    if (!name) {
      throw new BadRequestException({ code: 'INVALID_PET_NAME', message: 'name must not be blank.' });
    }

    return this.database.withTransaction(async (client) => {
      const result = await client.query<OwnerPetRow>(`
        UPDATE pet_schema.pets
        SET
          name = $3,
          species = $4,
          breed = $5,
          birth_date = $6::date,
          age_months = $7::integer,
          sex = $8,
          gender = $9,
          weight_kg = $10::numeric,
          sterilized = $11::boolean,
          is_sterilized = $12::boolean,
          chip_number = $13,
          allergies = $14::text[],
          chronic_conditions = $15::text[],
          vaccination_notes = $16,
          photo_url = $17,
          insurance_policy_links = $18::jsonb,
          profile_version = profile_version + 1,
          updated_at = clock_timestamp()
        WHERE id = $1::uuid AND owner_id = $2::uuid AND archived_at IS NULL
        RETURNING
          id, name, species, breed, birth_date, age_months, sex, gender,
          weight_kg::text, sterilized, is_sterilized, chip_number,
          allergies, chronic_conditions, vaccination_notes, photo_url,
          insurance_policy_links, medical_history_ocr, profile_version, archived_at, created_at, updated_at
      `, [
        petId,
        owner.sub,
        name,
        input.species ?? current.species,
        input.breed === undefined ? current.breed : this.blankToNull(input.breed),
        input.birthDate === undefined ? current.birthDate : input.birthDate,
        input.ageMonths === undefined ? current.ageMonths : input.ageMonths,
        input.sex === undefined ? (input.gender ?? current.sex) : input.sex,
        input.gender === undefined ? (input.sex === undefined ? current.gender : this.genderFromSex(input.sex)) : input.gender,
        input.weightKg === undefined ? current.weightKg : input.weightKg,
        input.sterilized === undefined ? (input.isSterilized ?? current.sterilized) : input.sterilized,
        input.isSterilized === undefined ? (input.sterilized ?? current.isSterilized) : input.isSterilized,
        input.chipNumber === undefined ? current.chipNumber : this.blankToNull(input.chipNumber),
        input.allergies === undefined ? current.allergies : this.cleanList(input.allergies),
        input.chronicConditions === undefined ? current.chronicConditions : this.cleanList(input.chronicConditions),
        input.vaccinationNotes === undefined ? current.vaccinationNotes : this.blankToNull(input.vaccinationNotes),
        input.photoUrl === undefined ? current.photoUrl : this.blankToNull(input.photoUrl),
        JSON.stringify(input.insurancePolicyLinks === undefined ? current.insurancePolicyLinks : this.cleanList(input.insurancePolicyLinks)),
      ]);
      const pet = this.toPet(result.rows[0]);
      await this.writePetAudit(client, owner.sub, pet.id, 'pet.updated', {
        changedFields: this.changedPetFields(input),
        previousProfileVersion: current.profileVersion,
        profileVersion: pet.profileVersion,
      });
      return pet;
    });
  }

  async uploadDocumentFile(
    owner: JwtPayload,
    petId: string,
    file: UploadedPetFile | undefined,
    docType: 'PASSPORT' | 'HISTORY',
  ): Promise<OwnerPetDocumentUpload> {
    if (docType !== 'PASSPORT' && docType !== 'HISTORY') {
      throw new BadRequestException({ code: 'INVALID_PET_DOCUMENT_TYPE', message: 'Document type is not supported.' });
    }
    this.validateUploadedFile(file, { allowPdf: true });
    await this.ensurePetActive(owner, petId);
    const stored = await this.storeUploadedFile(owner.sub, petId, file!);

    return this.database.withTransaction(async (client) => {
      const document = await client.query<PetDocumentRow>(`
        INSERT INTO pet_schema.pet_documents (
          id, pet_id, owner_id, file_url, doc_type, status,
          file_name, mime_type, file_size_bytes, storage_key
        )
        VALUES (
          $1::uuid, $2::uuid, $3::uuid, $4, $5, 'PROCESSED',
          $6, $7, $8::integer, $9
        )
        RETURNING
          id, pet_id, owner_id, file_url, doc_type, status,
          file_name, mime_type, file_size_bytes, storage_key, created_at
      `, [
        stored.documentId,
        petId,
        owner.sub,
        this.documentDownloadUrl(petId, stored.documentId),
        docType,
        stored.fileName,
        stored.mimeType,
        stored.fileSizeBytes,
        stored.storageKey,
      ]);

      await this.writePetAudit(client, owner.sub, petId, 'pet.document.uploaded', {
        documentId: document.rows[0].id,
        docType,
        mimeType: stored.mimeType,
        fileSizeBytes: stored.fileSizeBytes,
      });

      return this.toDocumentUpload(document.rows[0]);
    });
  }

  async uploadPetPhoto(owner: JwtPayload, petId: string, file: UploadedPetFile | undefined): Promise<OwnerPet> {
    this.validateUploadedFile(file, { allowPdf: false });
    await this.ensurePetActive(owner, petId);
    const stored = await this.storeUploadedFile(owner.sub, petId, file!);
    const photoUrl = this.documentDownloadUrl(petId, stored.documentId);

    return this.database.withTransaction(async (client) => {
      await client.query(`
        INSERT INTO pet_schema.pet_documents (
          id, pet_id, owner_id, file_url, doc_type, status,
          file_name, mime_type, file_size_bytes, storage_key
        )
        VALUES (
          $1::uuid, $2::uuid, $3::uuid, $4, 'PET_PHOTO', 'PROCESSED',
          $5, $6, $7::integer, $8
        )
      `, [
        stored.documentId,
        petId,
        owner.sub,
        photoUrl,
        stored.fileName,
        stored.mimeType,
        stored.fileSizeBytes,
        stored.storageKey,
      ]);

      const result = await client.query<OwnerPetRow>(`
        UPDATE pet_schema.pets
        SET photo_url = $3, profile_version = profile_version + 1, updated_at = clock_timestamp()
        WHERE id = $1::uuid AND owner_id = $2::uuid AND archived_at IS NULL
        RETURNING
          id, name, species, breed, birth_date, age_months, sex, gender,
          weight_kg::text, sterilized, is_sterilized, chip_number,
          allergies, chronic_conditions, vaccination_notes, photo_url,
          insurance_policy_links, medical_history_ocr, profile_version, archived_at, created_at, updated_at
      `, [petId, owner.sub, photoUrl]);

      if (!result.rows[0]) {
        throw new NotFoundException({ code: 'OWNER_PET_NOT_FOUND', message: 'Pet was not found.' });
      }

      await this.writePetAudit(client, owner.sub, petId, 'pet.photo.uploaded', {
        documentId: stored.documentId,
        mimeType: stored.mimeType,
        fileSizeBytes: stored.fileSizeBytes,
      });

      return this.toPet(result.rows[0]);
    });
  }

  async deletePetPhoto(owner: JwtPayload, petId: string): Promise<OwnerPet> {
    await this.ensurePetActive(owner, petId);
    return this.database.withTransaction(async (client) => {
      const result = await client.query<OwnerPetRow>(`
        UPDATE pet_schema.pets
        SET photo_url = NULL, profile_version = profile_version + 1, updated_at = clock_timestamp()
        WHERE id = $1::uuid AND owner_id = $2::uuid AND archived_at IS NULL
        RETURNING
          id, name, species, breed, birth_date, age_months, sex, gender,
          weight_kg::text, sterilized, is_sterilized, chip_number,
          allergies, chronic_conditions, vaccination_notes, photo_url,
          insurance_policy_links, medical_history_ocr, profile_version, archived_at, created_at, updated_at
      `, [petId, owner.sub]);

      if (!result.rows[0]) {
        throw new NotFoundException({ code: 'OWNER_PET_NOT_FOUND', message: 'Pet was not found.' });
      }

      await this.writePetAudit(client, owner.sub, petId, 'pet.photo.deleted', {});
      return this.toPet(result.rows[0]);
    });
  }

  async downloadDocument(owner: JwtPayload, petId: string, documentId: string): Promise<OwnerPetDocumentDownload> {
    const document = await this.readOwnedDocument(owner, petId, documentId);
    if (!document.storage_key || !document.mime_type || !document.file_size_bytes) {
      throw new NotFoundException({ code: 'OWNER_PET_DOCUMENT_NOT_FOUND', message: 'Document was not found.' });
    }
    const filePath = this.storagePath(document.storage_key);
    const fileStat = await stat(filePath).catch(() => null);
    if (!fileStat?.isFile()) {
      throw new NotFoundException({ code: 'OWNER_PET_DOCUMENT_NOT_FOUND', message: 'Document was not found.' });
    }
    await this.writeDocumentAccessAudit(owner.sub, petId, documentId, 'pet.document.content.read');
    return {
      stream: createReadStream(filePath),
      safeFileName: this.safeDownloadName(document.file_name ?? 'pet-document'),
      mimeType: document.mime_type,
      fileSizeBytes: document.file_size_bytes,
    };
  }

  async deleteDocument(owner: JwtPayload, petId: string, documentId: string): Promise<void> {
    await this.ensurePetActive(owner, petId);
    const result = await this.database.query<{ id: string }>(`
      UPDATE pet_schema.pet_documents
      SET deleted_at = clock_timestamp(), updated_at = clock_timestamp()
      WHERE id = $1::uuid
        AND pet_id = $2::uuid
        AND owner_id = $3::uuid
        AND deleted_at IS NULL
        AND doc_type IN ('PASSPORT', 'HISTORY')
      RETURNING id
    `, [documentId, petId, owner.sub]);
    if (!result.rows[0]) {
      throw new NotFoundException({ code: 'OWNER_PET_DOCUMENT_NOT_FOUND', message: 'Document was not found.' });
    }
  }

  private async writePetAudit(client: PoolClient, ownerId: string, petId: string, action: string, payload: Record<string, unknown>): Promise<void> {
    await client.query(`
      INSERT INTO audit_schema.audit_log (
        actor_type, actor_id, action, aggregate_type, aggregate_id, payload_json
      ) VALUES (
        'OWNER', $1, $2, 'pet', $3::uuid, $4::jsonb
      )
    `, [ownerId, action, petId, JSON.stringify(payload)]);
  }

  private async writeDocumentAccessAudit(
    ownerId: string,
    petId: string,
    documentId: string,
    action: string,
  ): Promise<void> {
    await this.database.query(`
      INSERT INTO audit_schema.audit_log (
        actor_type, actor_id, action, aggregate_type, aggregate_id, payload_json
      ) VALUES (
        'OWNER', $1::uuid, $2, 'pet_document', $3::uuid,
        jsonb_build_object('petId', $4::text)
      )
    `, [ownerId, action, documentId, petId]);
  }

  private changedPetFields(input: UpdateOwnerPetDto): string[] {
    return Object.keys(input)
      .filter((key) => key !== 'mutationId')
      .sort();
  }

  private toPet(row: OwnerPetRow): OwnerPet {
    return {
      id: row.id,
      name: row.name,
      species: row.species,
      breed: row.breed,
      birthDate: row.birth_date ? this.dateOnly(row.birth_date) : null,
      ageMonths: row.age_months,
      sex: row.sex,
      gender: row.gender,
      weightKg: row.weight_kg,
      sterilized: row.sterilized,
      isSterilized: row.is_sterilized,
      chipNumber: row.chip_number,
      allergies: row.allergies ?? [],
      chronicConditions: row.chronic_conditions ?? [],
      vaccinationNotes: row.vaccination_notes,
      photoUrl: row.photo_url,
      insurancePolicyLinks: row.insurance_policy_links ?? [],
      profileVersion: Number(row.profile_version),
      archivedAt: row.archived_at?.toISOString() ?? null,
      isArchived: Boolean(row.archived_at),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private async ensurePetOwned(owner: JwtPayload, petId: string): Promise<void> {
    const pet = await this.database.query<{ id: string }>(`
      SELECT id
      FROM pet_schema.pets
      WHERE id = $1::uuid AND owner_id = $2::uuid
      LIMIT 1
    `, [petId, owner.sub]);
    if (!pet.rows[0]) {
      throw new NotFoundException({ code: 'OWNER_PET_NOT_FOUND', message: 'Pet was not found.' });
    }
  }

  private async ensurePetActive(owner: JwtPayload, petId: string): Promise<void> {
    const result = await this.database.query<{ id: string; archived_at: Date | null }>(`
      SELECT id, archived_at
      FROM pet_schema.pets
      WHERE id = $1::uuid AND owner_id = $2::uuid
      LIMIT 1
    `, [petId, owner.sub]);
    if (!result.rows[0]) throw new NotFoundException({ code: 'OWNER_PET_NOT_FOUND', message: 'Pet was not found.' });
    if (result.rows[0].archived_at) {
      throw new BadRequestException({ code: 'OWNER_PET_ARCHIVED_READ_ONLY', message: 'Archived pet is read-only.' });
    }
  }

  private validateUploadedFile(file: UploadedPetFile | undefined, options: { allowPdf: boolean }): asserts file is UploadedPetFile {
    if (!file || !file.buffer || file.buffer.length === 0 || file.size <= 0) {
      throw new BadRequestException({ code: 'EMPTY_PET_FILE', message: 'File must not be empty.' });
    }
    if (file.size > PET_DOCUMENT_MAX_BYTES || file.buffer.length > PET_DOCUMENT_MAX_BYTES) {
      throw new BadRequestException({ code: 'PET_FILE_TOO_LARGE', message: 'File exceeds the allowed size.' });
    }
    if (!ALLOWED_DOCUMENT_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException({ code: 'UNSUPPORTED_PET_FILE_TYPE', message: 'File type is not supported.' });
    }
    if (!options.allowPdf && !ALLOWED_PHOTO_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException({ code: 'UNSUPPORTED_PET_FILE_TYPE', message: 'File type is not supported for pet photos.' });
    }
  }

  private async storeUploadedFile(ownerId: string, petId: string, file: UploadedPetFile): Promise<{
    documentId: string;
    storageKey: string;
    fileName: string;
    mimeType: string;
    fileSizeBytes: number;
  }> {
    const documentId = randomUUID();
    const extension = ALLOWED_DOCUMENT_MIME_TYPES.get(file.mimetype) ?? path.extname(file.originalname).toLowerCase();
    const fileName = this.safeDownloadName(file.originalname || `pet-document${extension}`);
    const storageKey = path.join(ownerId, petId, `${documentId}${extension}`);
    const filePath = this.storagePath(storageKey);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, file.buffer!);
    return {
      documentId,
      storageKey,
      fileName,
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
    };
  }

  private async readOwnedDocument(owner: JwtPayload, petId: string, documentId: string): Promise<PetDocumentRow> {
    const result = await this.database.query<PetDocumentRow>(`
      SELECT
        id, pet_id, owner_id, file_url, doc_type, status,
        file_name, mime_type, file_size_bytes, storage_key, created_at
      FROM pet_schema.pet_documents
      WHERE id = $1::uuid
        AND pet_id = $2::uuid
        AND owner_id = $3::uuid
        AND deleted_at IS NULL
      LIMIT 1
    `, [documentId, petId, owner.sub]);
    if (!result.rows[0]) {
      throw new NotFoundException({ code: 'OWNER_PET_DOCUMENT_NOT_FOUND', message: 'Document was not found.' });
    }
    return result.rows[0];
  }

  private toDocumentUpload(row: PetDocumentRow): OwnerPetDocumentUpload {
    return {
      documentId: row.id,
      petId: row.pet_id,
      fileUrl: row.file_url,
      docType: row.doc_type === 'PET_PHOTO' ? 'HISTORY' : row.doc_type,
      status: row.status,
      createdAt: row.created_at.toISOString(),
    };
  }

  private toCareDocument(row: PetDocumentRow): OwnerPetCareDocument {
    const fileName = row.file_name ?? this.documentLabel(row);
    const mimeType = row.mime_type ?? 'application/octet-stream';
    const sizeBytes = row.file_size_bytes ?? 0;
    return {
      id: row.id,
      type: row.doc_type === 'PET_PHOTO' ? 'HISTORY' : row.doc_type,
      label: this.documentLabel(row),
      value: row.file_url,
      fileName,
      mimeType,
      sizeBytes,
      createdAt: row.created_at.toISOString(),
      downloadUrl: row.file_url,
      canOpen: Boolean(row.storage_key),
      canDelete: row.doc_type !== 'PET_PHOTO',
      isImage: mimeType.startsWith('image/'),
    };
  }

  private documentLabel(row: PetDocumentRow): string {
    if (row.file_name) return row.file_name;
    return row.doc_type === 'PASSPORT' ? 'Документ питомца' : 'Медицинский файл';
  }

  private publicDiaryLifecycle(type: OwnerPetDiaryEntry['type'], persistedState: string): string {
    if (type === 'DOCUMENT') return persistedState;
    if (type === 'VISIT') return ownerAppointmentPresentation(persistedState, 'HISTORY').code;
    const telemedStates: Record<string, string> = {
      WAITING_FOR_DOCTOR: 'WAITING', CONNECTED: 'IN_PROGRESS', COMPLETED: 'COMPLETED',
      CANCELLED: 'CANCELLED', EXPIRED: 'EXPIRED', NO_SHOW: 'NO_SHOW',
    };
    return telemedStates[persistedState] ?? 'STATUS_UPDATED';
  }

  private documentDownloadUrl(petId: string, documentId: string): string {
    return `/v1/owner/pets/${petId}/documents/${documentId}/download`;
  }

  private storagePath(storageKey: string): string {
    const root = process.env.PET_DOCUMENT_STORAGE_DIR ?? path.resolve(process.cwd(), '.storage', 'pet-documents');
    const resolved = path.resolve(root, storageKey);
    const rootResolved = path.resolve(root);
    const relative = path.relative(rootResolved, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new BadRequestException({ code: 'INVALID_PET_DOCUMENT_STORAGE_KEY', message: 'Invalid document storage key.' });
    }
    return resolved;
  }

  private safeDownloadName(value: string): string {
    const normalized = path.basename(value).replace(/[\r\n"]/g, '').trim();
    return normalized.slice(0, 180) || 'pet-document';
  }

  private blankToNull(value: string | undefined | null): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private cleanList(value: string[] | undefined): string[] {
    return (value ?? []).map((item) => item.trim()).filter(Boolean).slice(0, 50);
  }

  private dateOnly(value: Date | string): string {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return value.slice(0, 10);
  }

  private genderFromSex(value: string | undefined | null): 'MALE' | 'FEMALE' | null {
    return value === 'MALE' || value === 'FEMALE' ? value : null;
  }
}
