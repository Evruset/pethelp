import { BadRequestException, Injectable, NotFoundException, PreconditionFailedException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { JwtPayload } from './auth.types';
import { CreateOwnerPetDto, UpdateOwnerPetDto } from './dto/owner-pet.dto';
import { ownerAppointmentPresentation, OwnerAppointmentPresentation } from './owner-appointments.service';

export type OwnerPet = {
  id: string;
  name: string;
  species: 'DOG' | 'CAT' | 'OTHER';
  breed: string | null;
  birthDate: string | null;
  sex: 'MALE' | 'FEMALE' | 'UNKNOWN' | null;
  weightKg: string | null;
  sterilized: boolean | null;
  allergies: string[];
  chronicConditions: string[];
  vaccinationNotes: string | null;
  photoUrl: string | null;
  insurancePolicyLinks: string[];
  profileVersion: number;
  createdAt: string;
  updatedAt: string;
};

export type OwnerPetCareDocument = {
  type: 'PHOTO' | 'VACCINATION_NOTES' | 'INSURANCE_POLICY_LINK';
  label: string;
  value: string;
};

export type OwnerPetCareVisit = {
  holdId: string;
  appointmentId: string | null;
  state: string;
  bucket: 'ACTIVE' | 'HISTORY';
  presentation: OwnerAppointmentPresentation;
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

type OwnerPetRow = {
  id: string;
  name: string;
  species: OwnerPet['species'];
  breed: string | null;
  birth_date: Date | string | null;
  sex: OwnerPet['sex'];
  weight_kg: string | null;
  sterilized: boolean | null;
  allergies: string[] | null;
  chronic_conditions: string[] | null;
  vaccination_notes: string | null;
  photo_url: string | null;
  insurance_policy_links: string[] | null;
  profile_version: string | number;
  created_at: Date;
  updated_at: Date;
};

@Injectable()
export class OwnerPetService {
  constructor(private readonly database: DatabaseService) {}

  async list(owner: JwtPayload): Promise<OwnerPet[]> {
    const result = await this.database.query<OwnerPetRow>(`
      SELECT
        id, name, species, breed, birth_date, sex, weight_kg::text, sterilized,
        allergies, chronic_conditions, vaccination_notes, photo_url,
        insurance_policy_links, profile_version, created_at, updated_at
      FROM pet_schema.pets
      WHERE owner_id = $1::uuid
      ORDER BY created_at ASC, id ASC
    `, [owner.sub]);
    return result.rows.map((row) => this.toPet(row));
  }

  async read(owner: JwtPayload, petId: string): Promise<OwnerPet | undefined> {
    const result = await this.database.query<OwnerPetRow>(`
      SELECT
        id, name, species, breed, birth_date, sex, weight_kg::text, sterilized,
        allergies, chronic_conditions, vaccination_notes, photo_url,
        insurance_policy_links, profile_version, created_at, updated_at
      FROM pet_schema.pets
      WHERE id = $1::uuid AND owner_id = $2::uuid
      LIMIT 1
    `, [petId, owner.sub]);
    return result.rows[0] ? this.toPet(result.rows[0]) : undefined;
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
    }>(`
      WITH server_time AS (SELECT clock_timestamp() AS value)
      SELECT
        hold.id AS hold_id,
        appointment.id AS appointment_id,
        COALESCE(appointment.status, hold.state) AS state,
        CASE
          WHEN slot.ends_at <= server_time.value THEN 'HISTORY'
          WHEN COALESCE(appointment.status, hold.state) IN (
            'MANUAL_CONFIRM_PENDING',
            'MIS_RESERVATION_PENDING',
            'MIS_RECONCILIATION_PENDING',
            'MIS_HELD',
            'ALTERNATIVE_PENDING',
            'CONFIRMED'
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
        service.currency
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

    const serverNow = await this.database.query<{ value: Date }>('SELECT clock_timestamp() AS value');
    return {
      pet,
      documents: this.careDocuments(pet),
      visits: visits.rows.map((row) => ({
        holdId: row.hold_id,
        appointmentId: row.appointment_id,
        state: row.state,
        bucket: row.bucket,
        presentation: ownerAppointmentPresentation(row.state, row.bucket),
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

  async create(owner: JwtPayload, input: CreateOwnerPetDto): Promise<OwnerPet> {
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException({ code: 'INVALID_PET_NAME', message: 'name must not be blank.' });
    }
    const result = await this.database.query<OwnerPetRow>(`
      INSERT INTO pet_schema.pets (
        owner_id, name, species, breed, birth_date, sex, weight_kg, sterilized,
        allergies, chronic_conditions, vaccination_notes, photo_url, insurance_policy_links
      )
      VALUES (
        $1::uuid, $2, $3, $4, $5::date, $6, $7::numeric, $8::boolean,
        $9::text[], $10::text[], $11, $12, $13::jsonb
      )
      RETURNING
        id, name, species, breed, birth_date, sex, weight_kg::text, sterilized,
        allergies, chronic_conditions, vaccination_notes, photo_url,
        insurance_policy_links, profile_version, created_at, updated_at
    `, [
      owner.sub,
      name,
      input.species,
      this.blankToNull(input.breed),
      input.birthDate ?? null,
      input.sex ?? null,
      input.weightKg ?? null,
      input.sterilized ?? null,
      this.cleanList(input.allergies),
      this.cleanList(input.chronicConditions),
      this.blankToNull(input.vaccinationNotes),
      this.blankToNull(input.photoUrl),
      JSON.stringify(this.cleanList(input.insurancePolicyLinks)),
    ]);
    return this.toPet(result.rows[0]);
  }

  async update(owner: JwtPayload, petId: string, input: UpdateOwnerPetDto, ifMatchVersion?: number): Promise<OwnerPet> {
    const current = await this.read(owner, petId);
    if (!current) {
      throw new NotFoundException({ code: 'OWNER_PET_NOT_FOUND', message: 'Pet was not found.' });
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

    const result = await this.database.query<OwnerPetRow>(`
      UPDATE pet_schema.pets
      SET
        name = $3,
        species = $4,
        breed = $5,
        birth_date = $6::date,
        sex = $7,
        weight_kg = $8::numeric,
        sterilized = $9::boolean,
        allergies = $10::text[],
        chronic_conditions = $11::text[],
        vaccination_notes = $12,
        photo_url = $13,
        insurance_policy_links = $14::jsonb,
        profile_version = profile_version + 1,
        updated_at = clock_timestamp()
      WHERE id = $1::uuid AND owner_id = $2::uuid
      RETURNING
        id, name, species, breed, birth_date, sex, weight_kg::text, sterilized,
        allergies, chronic_conditions, vaccination_notes, photo_url,
        insurance_policy_links, profile_version, created_at, updated_at
    `, [
      petId,
      owner.sub,
      name,
      input.species ?? current.species,
      input.breed === undefined ? current.breed : this.blankToNull(input.breed),
      input.birthDate === undefined ? current.birthDate : input.birthDate,
      input.sex === undefined ? current.sex : input.sex,
      input.weightKg === undefined ? current.weightKg : input.weightKg,
      input.sterilized === undefined ? current.sterilized : input.sterilized,
      input.allergies === undefined ? current.allergies : this.cleanList(input.allergies),
      input.chronicConditions === undefined ? current.chronicConditions : this.cleanList(input.chronicConditions),
      input.vaccinationNotes === undefined ? current.vaccinationNotes : this.blankToNull(input.vaccinationNotes),
      input.photoUrl === undefined ? current.photoUrl : this.blankToNull(input.photoUrl),
      JSON.stringify(input.insurancePolicyLinks === undefined ? current.insurancePolicyLinks : this.cleanList(input.insurancePolicyLinks)),
    ]);
    return this.toPet(result.rows[0]);
  }

  private toPet(row: OwnerPetRow): OwnerPet {
    return {
      id: row.id,
      name: row.name,
      species: row.species,
      breed: row.breed,
      birthDate: row.birth_date ? this.dateOnly(row.birth_date) : null,
      sex: row.sex,
      weightKg: row.weight_kg,
      sterilized: row.sterilized,
      allergies: row.allergies ?? [],
      chronicConditions: row.chronic_conditions ?? [],
      vaccinationNotes: row.vaccination_notes,
      photoUrl: row.photo_url,
      insurancePolicyLinks: row.insurance_policy_links ?? [],
      profileVersion: Number(row.profile_version),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private careDocuments(pet: OwnerPet): OwnerPetCareDocument[] {
    const documents: OwnerPetCareDocument[] = [];
    if (pet.photoUrl) {
      documents.push({ type: 'PHOTO', label: 'Фото питомца', value: pet.photoUrl });
    }
    if (pet.vaccinationNotes) {
      documents.push({ type: 'VACCINATION_NOTES', label: 'Вакцинация', value: pet.vaccinationNotes });
    }
    for (const [index, link] of pet.insurancePolicyLinks.entries()) {
      documents.push({ type: 'INSURANCE_POLICY_LINK', label: `Полис ${index + 1}`, value: link });
    }
    return documents;
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
}
