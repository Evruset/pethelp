import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { JwtPayload } from '../auth/auth.types';
import { ClinicEmployeeAccessService } from '../booking-core/clinic-employee-access.service';
import { DatabaseService } from '../database/database.service';
import { UpsertEmergencyProfileDto } from './dto/upsert-emergency-profile.dto';
import { EMERGENCY_SPECIES, EMERGENCY_STATUSES, EMERGENCY_VERIFICATION_STATUSES } from './emergency-routing.types';

@Injectable()
export class EmergencyProfileService {
  constructor(
    private readonly database: DatabaseService,
    private readonly clinicAccess: ClinicEmployeeAccessService,
  ) {}

  async upsert(clinicLocationId: string, dto: UpsertEmergencyProfileDto, employee: JwtPayload) {
    validate(dto);
    const validUntil = new Date(dto.validUntil);

    return this.database.withTransaction(async (client) => {
      await this.clinicAccess.assertLocationAccess(client, employee, clinicLocationId);
      const location = await client.query<{ id: string }>(`
        SELECT id::text FROM clinic_schema.clinic_locations
        WHERE id = $1::uuid
        FOR SHARE
      `, [clinicLocationId]);
      if (!location.rows[0]) throw new NotFoundException({ code: 'CLINIC_LOCATION_NOT_FOUND', message: 'Clinic location not found' });

      const timeValidation = await client.query<{ is_future: boolean }>(`
        SELECT $1::timestamptz > clock_timestamp() AS is_future
      `, [validUntil.toISOString()]);
      if (!timeValidation.rows[0]?.is_future) throw new BadRequestException('validUntil must be in the future');

      const profile = await client.query<{ id: string }>(`
        INSERT INTO clinic_schema.emergency_capability_profiles (
          clinic_location_id, accepts_emergency_now, emergency_status,
          status_updated_at, verification_status, verified_at, valid_until,
          capability_version, emergency_contact_phone, updated_at
        )
        VALUES (
          $1::uuid, $2::boolean, $3::text, clock_timestamp(), $4::text,
          CASE WHEN $4::text = 'VERIFIED' THEN clock_timestamp() ELSE NULL END,
          $5::timestamptz, $6::text, $7::text, clock_timestamp()
        )
        ON CONFLICT (clinic_location_id) DO UPDATE SET
          accepts_emergency_now = EXCLUDED.accepts_emergency_now,
          emergency_status = EXCLUDED.emergency_status,
          status_updated_at = EXCLUDED.status_updated_at,
          verification_status = EXCLUDED.verification_status,
          verified_at = EXCLUDED.verified_at,
          valid_until = EXCLUDED.valid_until,
          capability_version = EXCLUDED.capability_version,
          emergency_contact_phone = EXCLUDED.emergency_contact_phone,
          updated_at = clock_timestamp()
        RETURNING id::text
      `, [
        clinicLocationId,
        dto.emergencyStatus === 'ACCEPTING_NOW',
        dto.emergencyStatus,
        dto.verificationStatus,
        validUntil.toISOString(),
        dto.capabilityVersion.trim(),
        dto.emergencyContactPhone?.trim() || null,
      ]);

      const profileId = profile.rows[0].id;
      await client.query('DELETE FROM clinic_schema.emergency_capabilities WHERE profile_id = $1::uuid', [profileId]);
      for (const capability of dto.capabilities) {
        await client.query(`
          INSERT INTO clinic_schema.emergency_capabilities (
            profile_id, capability_code, species, available_24x7, source, evidence_reference
          ) VALUES ($1::uuid, $2::text, $3::text, $4::boolean, $5::text, $6::text)
        `, [
          profileId,
          capability.capabilityCode.trim().toUpperCase(),
          capability.species,
          capability.available24x7,
          capability.source.trim(),
          capability.evidenceReference?.trim() || null,
        ]);
      }

      return {
        clinicLocationId,
        emergencyStatus: dto.emergencyStatus,
        verificationStatus: dto.verificationStatus,
        validUntil: validUntil.toISOString(),
        capabilityCount: dto.capabilities.length,
      };
    });
  }
}

function validate(dto: UpsertEmergencyProfileDto): void {
  if (!EMERGENCY_STATUSES.includes(dto.emergencyStatus as never)) throw new BadRequestException('Unsupported emergencyStatus');
  if (!EMERGENCY_VERIFICATION_STATUSES.includes(dto.verificationStatus as never)) throw new BadRequestException('Unsupported verificationStatus');
  if (!dto.capabilityVersion?.trim()) throw new BadRequestException('capabilityVersion is required');
  if (!Array.isArray(dto.capabilities) || dto.capabilities.length === 0) throw new BadRequestException('At least one capability is required');
  if (Number.isNaN(Date.parse(dto.validUntil))) throw new BadRequestException('validUntil must be a valid timestamp');
  if (dto.emergencyStatus === 'ACCEPTING_NOW' && dto.verificationStatus !== 'VERIFIED') throw new BadRequestException('An accepting emergency profile must be verified');

  const unique = new Set<string>();
  for (const capability of dto.capabilities) {
    const code = capability.capabilityCode?.trim().toUpperCase();
    if (!code || !/^[A-Z][A-Z0-9_]{1,63}$/.test(code)) throw new BadRequestException('Invalid capabilityCode');
    if (!EMERGENCY_SPECIES.includes(capability.species)) throw new BadRequestException('Unsupported capability species');
    if (!capability.source?.trim()) throw new BadRequestException('Capability source is required');
    const key = `${code}:${capability.species}`;
    if (unique.has(key)) throw new BadRequestException('Duplicate capability for species');
    unique.add(key);
  }
}
