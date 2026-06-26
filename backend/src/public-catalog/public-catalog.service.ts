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

type PublicClinicRow = {
  clinic_id: string;
  clinic_name: string;
  location_count: string;
  service_count: string;
  next_available_at: Date | null;
  server_now: Date;
};

type PublicServiceRow = {
  id: string;
  code: string;
  display_name: string;
  duration_minutes: number;
  price_amount: string;
  currency: string;
};

type PublicAvailabilityRow = {
  id: string;
  starts_at: Date;
  ends_at: Date;
  remaining_capacity: string;
  service_id: string | null;
  service_name: string | null;
  server_now: Date;
};

export type PublicCatalogFilters = {
  query?: string;
  serviceCode?: string;
  availableFrom?: Date;
  availableTo?: Date;
  openNow?: boolean;
  sort?: 'soonest' | 'name';
  limit: number;
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

export type PublicClinicSummary = {
  id: string;
  name: string;
  locationCount: number;
  serviceCount: number;
  nextAvailableAt: string | null;
};

export type PublicClinicsResponse = {
  observedAt: string;
  clinics: PublicClinicSummary[];
};

export type PublicClinicDetail = PublicClinicSummary & {
  locations: PublicCatalogResponse['locations'];
};

export type PublicLocationServicesResponse = {
  locationId: string;
  services: Array<{
    id: string;
    code: string;
    displayName: string;
    durationMinutes: number;
    priceAmount: string;
    currency: string;
  }>;
};

export type PublicAvailabilityResponse = {
  locationId: string;
  observedAt: string;
  slots: Array<{
    id: string;
    startsAt: string;
    endsAt: string;
    remainingCapacity: number;
    service: { id: string | null; name: string | null };
  }>;
};

@Injectable()
export class PublicCatalogService {
  constructor(private readonly database: DatabaseService) {}

  async listClinics(input: PublicCatalogFilters): Promise<PublicClinicsResponse> {
    const query = input.query?.trim() || null;
    const serviceCode = input.serviceCode?.trim().toUpperCase() || null;
    const availabilityFrom = input.availableFrom ?? null;
    const availabilityTo = input.availableTo ?? null;
    const onlyOpen = input.openNow === true || Boolean(availabilityFrom || availabilityTo);
    const sortByName = input.sort === 'name';
    const result = await this.database.query<PublicClinicRow>(`
      WITH server_time AS (SELECT clock_timestamp() AS value)
      SELECT
        clinic.id AS clinic_id,
        clinic.public_name AS clinic_name,
        COUNT(DISTINCT location.id)::text AS location_count,
        COUNT(DISTINCT service.id)::text AS service_count,
        MIN(slot.starts_at) FILTER (
          WHERE slot.state = 'OPEN'
            AND slot.starts_at >= GREATEST(COALESCE($4::timestamptz, server_time.value), server_time.value)
            AND ($5::timestamptz IS NULL OR slot.starts_at < $5::timestamptz)
            AND slot.capacity - slot.booked_count - slot.held_count > 0
        ) AS next_available_at,
        server_time.value AS server_now
      FROM clinic_schema.clinics clinic
      JOIN clinic_schema.clinic_locations location ON location.clinic_id = clinic.id AND location.status = 'ACTIVE'
      JOIN clinic_schema.clinic_services service ON service.clinic_location_id = location.id AND service.active = true
      LEFT JOIN clinic_schema.appointment_slots slot ON slot.clinic_location_id = location.id
        AND slot.service_id = service.id
      CROSS JOIN server_time
      WHERE clinic.status = 'ACTIVE'
        AND (
          $1::text IS NULL
          OR clinic.public_name ILIKE '%' || $1 || '%'
          OR location.address ILIKE '%' || $1 || '%'
          OR service.display_name ILIKE '%' || $1 || '%'
        )
        AND ($3::text IS NULL OR service.code = $3::text)
        AND (
          $6::boolean = false
          OR EXISTS (
            SELECT 1
            FROM clinic_schema.appointment_slots available_slot
            JOIN clinic_schema.clinic_services available_service
              ON available_service.id = available_slot.service_id
             AND available_service.active = true
            WHERE available_slot.clinic_location_id = location.id
              AND available_slot.state = 'OPEN'
              AND available_slot.starts_at >= GREATEST(COALESCE($4::timestamptz, server_time.value), server_time.value)
              AND ($5::timestamptz IS NULL OR available_slot.starts_at < $5::timestamptz)
              AND available_slot.capacity - available_slot.booked_count - available_slot.held_count > 0
              AND ($3::text IS NULL OR available_service.code = $3::text)
          )
        )
      GROUP BY clinic.id, clinic.public_name, server_time.value
      ORDER BY
        CASE WHEN $7::boolean THEN clinic.public_name END ASC,
        CASE WHEN NOT $7::boolean THEN MIN(slot.starts_at) FILTER (
          WHERE slot.state = 'OPEN'
            AND slot.starts_at >= GREATEST(COALESCE($4::timestamptz, server_time.value), server_time.value)
            AND ($5::timestamptz IS NULL OR slot.starts_at < $5::timestamptz)
            AND slot.capacity - slot.booked_count - slot.held_count > 0
        ) END ASC NULLS LAST,
        clinic.public_name ASC,
        clinic.id ASC
      LIMIT $2
    `, [query, input.limit, serviceCode, availabilityFrom, availabilityTo, onlyOpen, sortByName]);

    return {
      observedAt: result.rows[0]?.server_now.toISOString() ?? new Date().toISOString(),
      clinics: result.rows.map(this.toClinicSummary),
    };
  }

  async readClinic(clinicId: string): Promise<PublicClinicDetail | undefined> {
    const clinics = await this.database.query<PublicClinicRow>(`
      WITH server_time AS (SELECT clock_timestamp() AS value)
      SELECT
        clinic.id AS clinic_id,
        clinic.public_name AS clinic_name,
        COUNT(DISTINCT location.id)::text AS location_count,
        COUNT(DISTINCT service.id)::text AS service_count,
        MIN(slot.starts_at) FILTER (
          WHERE slot.state = 'OPEN'
            AND slot.starts_at > server_time.value
            AND slot.capacity - slot.booked_count - slot.held_count > 0
        ) AS next_available_at,
        server_time.value AS server_now
      FROM clinic_schema.clinics clinic
      JOIN clinic_schema.clinic_locations location ON location.clinic_id = clinic.id AND location.status = 'ACTIVE'
      JOIN clinic_schema.clinic_services service ON service.clinic_location_id = location.id AND service.active = true
      LEFT JOIN clinic_schema.appointment_slots slot ON slot.clinic_location_id = location.id
      CROSS JOIN server_time
      WHERE clinic.id = $1::uuid AND clinic.status = 'ACTIVE'
      GROUP BY clinic.id, clinic.public_name, server_time.value
      LIMIT 1
    `, [clinicId]);
    const row = clinics.rows[0];
    if (!row) return undefined;
    const locations = await this.listClinicLocations({ clinicId, limit: 50 });
    return { ...this.toClinicSummary(row), locations: locations.locations };
  }

  async listClinicLocations(input: { query?: string; clinicId?: string; serviceCode?: string; openNow?: boolean; limit: number }): Promise<PublicCatalogResponse> {
    const query = input.query?.trim() || null;
    const serviceCode = input.serviceCode?.trim().toUpperCase() || null;
    const onlyOpen = input.openNow === true;
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
          JOIN clinic_schema.clinic_services slot_service
            ON slot_service.id = slot.service_id
           AND slot_service.active = true
          WHERE slot.clinic_location_id = location.id
            AND slot.state = 'OPEN'
            AND slot.starts_at > server_time.value
            AND slot.capacity - slot.booked_count - slot.held_count > 0
            AND ($4::text IS NULL OR slot_service.code = $4::text)
        ) AS has_open_slots,
        server_time.value AS server_now
      FROM clinic_schema.clinics clinic
      JOIN clinic_schema.clinic_locations location
        ON location.clinic_id = clinic.id
      CROSS JOIN server_time
      WHERE clinic.status = 'ACTIVE'
        AND location.status = 'ACTIVE'
        AND ($3::uuid IS NULL OR clinic.id = $3::uuid)
        AND EXISTS (
          SELECT 1
          FROM clinic_schema.clinic_services service
          WHERE service.clinic_location_id = location.id
            AND service.active = true
            AND ($4::text IS NULL OR service.code = $4::text)
        )
        AND (
          $5::boolean = false
          OR EXISTS (
            SELECT 1
            FROM clinic_schema.appointment_slots slot
            JOIN clinic_schema.clinic_services service
              ON service.id = slot.service_id
             AND service.active = true
            WHERE slot.clinic_location_id = location.id
              AND slot.state = 'OPEN'
                AND slot.starts_at > server_time.value
              AND slot.capacity - slot.booked_count - slot.held_count > 0
              AND ($4::text IS NULL OR service.code = $4::text)
          )
        )
        AND (
          $1::text IS NULL
          OR clinic.public_name ILIKE '%' || $1 || '%'
          OR location.address ILIKE '%' || $1 || '%'
        )
      ORDER BY has_open_slots DESC, clinic.public_name ASC, location.address ASC, location.id ASC
      LIMIT $2
    `, [query, input.limit, input.clinicId ?? null, serviceCode, onlyOpen]);

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

  async listLocationServices(locationId: string): Promise<PublicLocationServicesResponse> {
    const result = await this.database.query<PublicServiceRow>(`
      SELECT id, code, display_name, duration_minutes, price_amount::text AS price_amount, currency
      FROM clinic_schema.clinic_services
      WHERE clinic_location_id = $1::uuid
        AND active = true
      ORDER BY display_name ASC, code ASC, id ASC
    `, [locationId]);
    return {
      locationId,
      services: result.rows.map((row) => ({
        id: row.id,
        code: row.code,
        displayName: row.display_name,
        durationMinutes: row.duration_minutes,
        priceAmount: row.price_amount,
        currency: row.currency,
      })),
    };
  }

  async readLocationAvailability(input: { locationId: string; from: Date; to: Date; limit: number }): Promise<PublicAvailabilityResponse> {
    const result = await this.database.query<PublicAvailabilityRow>(`
      WITH server_time AS (SELECT clock_timestamp() AS value)
      SELECT
        slot.id,
        slot.starts_at,
        slot.ends_at,
        (slot.capacity - slot.booked_count - slot.held_count)::text AS remaining_capacity,
        service.id AS service_id,
        service.display_name AS service_name,
        server_time.value AS server_now
      FROM clinic_schema.appointment_slots slot
      LEFT JOIN clinic_schema.clinic_services service ON service.id = slot.service_id
      JOIN clinic_schema.clinic_locations location ON location.id = slot.clinic_location_id
      JOIN clinic_schema.clinics clinic ON clinic.id = location.clinic_id
      CROSS JOIN server_time
      WHERE slot.clinic_location_id = $1::uuid
        AND clinic.status = 'ACTIVE'
        AND location.status = 'ACTIVE'
        AND slot.state = 'OPEN'
        AND slot.starts_at >= GREATEST($2::timestamptz, server_time.value)
        AND slot.starts_at < $3::timestamptz
        AND slot.capacity - slot.booked_count - slot.held_count > 0
      ORDER BY slot.starts_at ASC, slot.id ASC
      LIMIT $4
    `, [input.locationId, input.from, input.to, input.limit]);
    return {
      locationId: input.locationId,
      observedAt: result.rows[0]?.server_now.toISOString() ?? new Date().toISOString(),
      slots: result.rows.map((row) => ({
        id: row.id,
        startsAt: row.starts_at.toISOString(),
        endsAt: row.ends_at.toISOString(),
        remainingCapacity: Number(row.remaining_capacity),
        service: { id: row.service_id, name: row.service_name },
      })),
    };
  }

  private toClinicSummary(row: PublicClinicRow): PublicClinicSummary {
    return {
      id: row.clinic_id,
      name: row.clinic_name,
      locationCount: Number(row.location_count),
      serviceCount: Number(row.service_count),
      nextAvailableAt: row.next_available_at?.toISOString() ?? null,
    };
  }
}
