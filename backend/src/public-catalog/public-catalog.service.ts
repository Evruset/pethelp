import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

type ClinicLocationRow = {
  clinic_id: string;
  clinic_name: string;
  location_id: string;
  address: string;
  latitude: number | string | null;
  longitude: number | string | null;
  phone: string | null;
  has_open_slots: boolean;
  server_now: Date;
};

export type PublicCatalogResponse = {
  observedAt: string;
  locations: Array<{
    clinic: { id: string; name: string };
    location: {
      id: string;
      address: string;
      latitude: number | null;
      longitude: number | null;
      phone: string | null;
    };
    availability: {
      mode: 'READ_ONLY_SNAPSHOT';
      hasOpenSlots: boolean;
      observedAt: string;
    };
  }>;
};

@Injectable()
export class PublicCatalogService {
  constructor(private readonly database: DatabaseService) {}

  async listClinicLocations(input: { query?: string; limit: number }): Promise<PublicCatalogResponse> {
    const query = input.query?.trim() || null;
    const result = await this.database.query<ClinicLocationRow>(`
      WITH server_time AS (
        SELECT clock_timestamp() AS value
      )
      SELECT
        clinic.id AS clinic_id,
        clinic.public_name AS clinic_name,
        location.id AS location_id,
        location.address,
        location.latitude,
        location.longitude,
        location.phone,
        EXISTS (
          SELECT 1
          FROM clinic_schema.appointment_slots slot
          WHERE slot.clinic_location_id = location.id
            AND slot.state = 'OPEN'
            AND slot.starts_at > server_time.value
            AND slot.capacity - slot.booked_count - slot.held_count > 0
        ) AS has_open_slots,
        server_time.value AS server_now
      FROM clinic_schema.clinics clinic
      JOIN clinic_schema.clinic_locations location
        ON location.clinic_id = clinic.id
      CROSS JOIN server_time
      WHERE location.status = 'ACTIVE'
        AND EXISTS (
          SELECT 1
          FROM clinic_schema.clinic_services service
          WHERE service.clinic_location_id = location.id
            AND service.active = true
        )
        AND (
          $1::text IS NULL
          OR clinic.public_name ILIKE '%' || $1 || '%'
          OR location.address ILIKE '%' || $1 || '%'
        )
      ORDER BY has_open_slots DESC, clinic.public_name ASC, location.address ASC, location.id ASC
      LIMIT $2
    `, [query, input.limit]);

    const observedAt = result.rows[0]?.server_now.toISOString() ?? new Date().toISOString();
    return {
      observedAt,
      locations: result.rows.map((row) => ({
        clinic: { id: row.clinic_id, name: row.clinic_name },
        location: {
          id: row.location_id,
          address: row.address,
          latitude: row.latitude === null ? null : Number(row.latitude),
          longitude: row.longitude === null ? null : Number(row.longitude),
          phone: row.phone,
        },
        availability: {
          mode: 'READ_ONLY_SNAPSHOT',
          hasOpenSlots: row.has_open_slots,
          observedAt: row.server_now.toISOString(),
        },
      })),
    };
  }
}
