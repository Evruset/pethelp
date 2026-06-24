import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { SearchEmergencyClinicsDto } from './dto/search-emergency-clinics.dto';

interface CandidateRow {
  clinic_location_id: string;
  clinic_id: string;
  clinic_name: string;
  address: string;
  latitude: string | null;
  longitude: string | null;
  emergency_contact_phone: string | null;
  status_updated_at: Date;
  valid_until: Date;
  matching_capabilities: string[];
}

@Injectable()
export class EmergencyRoutingService {
  constructor(private readonly database: DatabaseService) {}

  async search(dto: SearchEmergencyClinicsDto) {
    const requiredCapabilities = parseCapabilities(dto.requiredCapabilities);
    const latitude = coordinate(dto.latitude, -90, 90);
    const longitude = coordinate(dto.longitude, -180, 180);
    if ((latitude === null) !== (longitude === null)) throw new BadRequestException('latitude and longitude must be provided together');
    const limit = dto.limit === undefined ? 10 : Number(dto.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new BadRequestException('limit must be an integer from 1 to 20');

    const result = await this.database.query<CandidateRow>(`
      SELECT p.clinic_location_id::text, l.clinic_id::text,
        COALESCE(c.public_name, c.legal_name) AS clinic_name, l.address,
        l.latitude::text, l.longitude::text, p.emergency_contact_phone,
        p.status_updated_at, p.valid_until,
        array_agg(DISTINCT ec.capability_code ORDER BY ec.capability_code) AS matching_capabilities
      FROM clinic_schema.emergency_capability_profiles p
      JOIN clinic_schema.clinic_locations l ON l.id = p.clinic_location_id
      JOIN clinic_schema.clinics c ON c.id = l.clinic_id
      JOIN clinic_schema.emergency_capabilities ec
        ON ec.profile_id = p.id AND ec.species IN ($1::text, 'ALL')
      WHERE p.accepts_emergency_now = true
        AND p.emergency_status = 'ACCEPTING_NOW'
        AND p.verification_status = 'VERIFIED'
        AND p.valid_until > clock_timestamp()
        AND NOT EXISTS (
          SELECT 1 FROM unnest($2::text[]) AS requested(capability_code)
          WHERE NOT EXISTS (
            SELECT 1 FROM clinic_schema.emergency_capabilities required_capability
            WHERE required_capability.profile_id = p.id
              AND required_capability.capability_code = requested.capability_code
              AND required_capability.species IN ($1::text, 'ALL')
          )
        )
      GROUP BY p.clinic_location_id, l.clinic_id, c.public_name, c.legal_name,
        l.address, l.latitude, l.longitude, p.emergency_contact_phone,
        p.status_updated_at, p.valid_until
    `, [dto.species, requiredCapabilities]);

    return result.rows.map((row) => formatCandidate(row, latitude, longitude))
      .sort((left, right) => compareCandidates(left, right))
      .slice(0, limit);
  }
}

function parseCapabilities(value: string | undefined): string[] {
  if (!value) return [];
  const capabilities = [...new Set(value.split(',').map((entry) => entry.trim().toUpperCase()).filter(Boolean))];
  if (capabilities.some((entry) => !/^[A-Z][A-Z0-9_]{1,63}$/.test(entry))) throw new BadRequestException('Invalid required capability');
  return capabilities;
}

function coordinate(value: string | undefined, min: number, max: number): number | null {
  if (value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) throw new BadRequestException('Coordinate is out of range');
  return parsed;
}

function formatCandidate(row: CandidateRow, latitude: number | null, longitude: number | null) {
  const candidateLatitude = row.latitude === null ? null : Number(row.latitude);
  const candidateLongitude = row.longitude === null ? null : Number(row.longitude);
  return {
    clinicLocationId: row.clinic_location_id,
    clinicId: row.clinic_id,
    clinicName: row.clinic_name,
    address: row.address,
    latitude: candidateLatitude,
    longitude: candidateLongitude,
    emergencyContactPhone: row.emergency_contact_phone,
    statusUpdatedAt: row.status_updated_at.toISOString(),
    validUntil: row.valid_until.toISOString(),
    matchingCapabilities: row.matching_capabilities,
    straightLineDistanceKm: latitude === null || longitude === null || candidateLatitude === null || candidateLongitude === null
      ? null : haversine(latitude, longitude, candidateLatitude, candidateLongitude),
  };
}

function compareCandidates(left: { matchingCapabilities: string[]; straightLineDistanceKm: number | null; clinicName: string }, right: { matchingCapabilities: string[]; straightLineDistanceKm: number | null; clinicName: string }): number {
  if (left.matchingCapabilities.length !== right.matchingCapabilities.length) return right.matchingCapabilities.length - left.matchingCapabilities.length;
  if (left.straightLineDistanceKm === null) return right.straightLineDistanceKm === null ? left.clinicName.localeCompare(right.clinicName) : 1;
  if (right.straightLineDistanceKm === null) return -1;
  return left.straightLineDistanceKm - right.straightLineDistanceKm;
}

function haversine(latitudeA: number, longitudeA: number, latitudeB: number, longitudeB: number): number {
  const radians = (value: number) => value * Math.PI / 180;
  const a = Math.sin(radians(latitudeB - latitudeA) / 2) ** 2 + Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB)) * Math.sin(radians(longitudeB - longitudeA) / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}
