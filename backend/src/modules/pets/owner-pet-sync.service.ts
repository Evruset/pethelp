import { HttpStatus, Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DomainException } from '../../common/domain-error';
import { DatabaseService } from '../../database/database.service';
import { OwnerPetMutationDto } from './owner-pet-sync.dto';

const SUPPORTED_SCHEMA_VERSION = 1;
const EDITABLE_FIELDS = new Set(['name', 'species']);

interface PetRow {
  id: string;
  owner_id: string;
  name: string;
  species: string;
  version: number;
}

interface ExistingMutation {
  response_body: Record<string, unknown>;
}

export interface OwnerPetMutationResult {
  petId: string;
  version: number;
  name: string;
  species: string;
  mutationId: string;
}

@Injectable()
export class OwnerPetSyncService {
  constructor(private readonly database: DatabaseService) {}

  async apply(petId: string, ownerId: string, dto: OwnerPetMutationDto, correlationId: string): Promise<OwnerPetMutationResult> {
    return this.database.withTransaction(async (client) => {
      await client.query("SET LOCAL lock_timeout = '50ms'");
      await client.query("SET LOCAL statement_timeout = '250ms'");

      const existing = await client.query<ExistingMutation>(`
        SELECT response_body
        FROM pet_schema.client_mutations
        WHERE mutation_id = $1::uuid
        FOR SHARE
      `, [dto.mutationId]);
      if (existing.rows[0]) return existing.rows[0].response_body as unknown as OwnerPetMutationResult;

      const pet = await this.lockPet(client, petId);
      if (pet.owner_id !== ownerId) {
        throw new DomainException(HttpStatus.FORBIDDEN, 'PET_OWNERSHIP_MISMATCH', 'Pet ownership mismatch');
      }
      this.validateMutation(dto);
      await this.assertDeviceSequence(client, petId, dto.deviceId, dto.deviceSequence);
      if (pet.version !== dto.baseServerVersion) {
        throw new DomainException(HttpStatus.CONFLICT, 'ENTITY_CONFLICT', 'Pet was changed in another session');
      }

      const name = dto.changedFields.contains('name') ? this.value(dto.payload, 'name') : pet.name;
      const species = dto.changedFields.contains('species') ? this.value(dto.payload, 'species') : pet.species;
      const updated = await client.query<PetRow>(`
        UPDATE pet_schema.pets
        SET name = $2,
            species = $3,
            version = version + 1,
            updated_at = clock_timestamp()
        WHERE id = $1::uuid
        RETURNING id, owner_id, name, species, version
      `, [petId, name, species]);
      const result: OwnerPetMutationResult = {
        petId: updated.rows[0].id,
        version: updated.rows[0].version,
        name: updated.rows[0].name,
        species: updated.rows[0].species,
        mutationId: dto.mutationId,
      };

      await client.query(`
        INSERT INTO pet_schema.client_mutations (
          mutation_id, pet_id, owner_id, device_id, device_sequence,
          base_server_version, payload_schema_version, changed_fields,
          client_occurred_at, state, response_body
        ) VALUES (
          $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5,
          $6, $7, $8::jsonb, $9::timestamptz, 'APPLIED', $10::jsonb
        )
      `, [
        dto.mutationId,
        petId,
        ownerId,
        dto.deviceId,
        dto.deviceSequence,
        dto.baseServerVersion,
        dto.payloadSchemaVersion,
        JSON.stringify(dto.changedFields),
        dto.clientOccurredAt,
        JSON.stringify(result),
      ]);
      await this.writeAudit(client, ownerId, petId, correlationId, dto, result);
      return result;
    });
  }

  private async lockPet(client: PoolClient, petId: string): Promise<PetRow> {
    const result = await client.query<PetRow>(`
      SELECT id, owner_id, name, species, version
      FROM pet_schema.pets
      WHERE id = $1::uuid
      FOR UPDATE
    `, [petId]);
    const pet = result.rows[0];
    if (!pet) throw new DomainException(HttpStatus.NOT_FOUND, 'PET_NOT_FOUND', 'Pet not found');
    return pet;
  }

  private validateMutation(dto: OwnerPetMutationDto): void {
    if (dto.payloadSchemaVersion != SUPPORTED_SCHEMA_VERSION) {
      throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'SCHEMA_VERSION_UNSUPPORTED', 'Client schema version is not supported');
    }
    if (dto.changedFields.any((field) => !EDITABLE_FIELDS.contains(field))) {
      throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'INVALID_MUTATION_FIELD', 'Mutation contains unsupported fields');
    }
    for (final field in dto.changedFields) {
      this.value(dto.payload, field);
    }
  }

  private value(payload: Record<string, unknown>, field: string): string {
    const value = payload[field];
    if (typeof value !== 'string' || value.trim().isEmpty || value.length > 120) {
      throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'INVALID_MUTATION_PAYLOAD', `Invalid ${field}`);
    }
    return value.trim();
  }

  private async assertDeviceSequence(client: PoolClient, petId: string, deviceId: string, sequence: number): Promise<void> {
    const result = await client.query<{ max_sequence: string | null }>(`
      SELECT MAX(device_sequence)::text AS max_sequence
      FROM pet_schema.client_mutations
      WHERE pet_id = $1::uuid AND device_id = $2::uuid
      FOR SHARE
    `, [petId, deviceId]);
    const previous = result.rows[0]?.max_sequence == null ? null : Number(result.rows[0].max_sequence);
    if (previous != null && sequence <= previous) {
      throw new DomainException(HttpStatus.CONFLICT, 'DEVICE_SEQUENCE_STALE', 'Device sequence is stale');
    }
  }

  private async writeAudit(
    client: PoolClient,
    ownerId: string,
    petId: string,
    correlationId: string,
    dto: OwnerPetMutationDto,
    result: OwnerPetMutationResult,
  ): Promise<void> {
    await client.query(`
      INSERT INTO audit_schema.audit_log (
        actor_type, actor_id, action, aggregate_type, aggregate_id, correlation_id, payload_json
      ) VALUES (
        'OWNER', $1::uuid, 'PET_PROFILE_SYNCED', 'pet', $2::uuid, $3::uuid,
        jsonb_build_object('mutationId', $4::uuid, 'deviceId', $5::uuid, 'deviceSequence', $6, 'version', $7)
      )
    `, [ownerId, petId, correlationId, dto.mutationId, dto.deviceId, dto.deviceSequence, result.version]);
  }
}
