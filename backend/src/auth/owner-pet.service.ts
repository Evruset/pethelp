import { BadRequestException, Injectable, NotFoundException, PreconditionFailedException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { JwtPayload } from './auth.types';
import { CreateOwnerPetDto, UpdateOwnerPetDto } from './dto/owner-pet.dto';

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
