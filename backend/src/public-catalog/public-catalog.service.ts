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
  distance_km: string | null;
  telemed_available: boolean;
  emergency_available: boolean;
  doctor_count: string;
  price_from: string | null;
  availability_source_updated_at: Date | null;
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
  source_updated_at: Date;
  confirmation_mode: PublicConfirmationMode;
  server_now: Date;
};

type BookingSelectionLocationRow = {
  clinic_id: string;
  clinic_name: string;
  location_id: string;
  address: string;
  timezone: string;
  server_now: Date;
};

type BookingSelectionSlotRow = {
  id: string;
  service_id: string;
  starts_at: Date;
  ends_at: Date;
  version: number;
  source_updated_at: Date;
  confirmation_mode: PublicConfirmationMode;
  available_date: string;
  local_time: string;
};

type PublicDoctorRow = {
  doctor_id: string;
  display_name: string;
  clinic_id: string;
  clinic_name: string;
  location_id: string;
  address: string;
  next_available_at: Date | null;
  source_updated_at: Date | null;
  server_now: Date;
};

export type PublicAvailabilityFreshness = 'CURRENT' | 'AGING' | 'STALE' | 'UNAVAILABLE';
export type PublicConfirmationMode = 'INSTANT' | 'CLINIC_CONFIRMATION' | 'ALTERNATIVE_POSSIBLE';

export type PublicCatalogFilters = {
  query?: string;
  serviceCode?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  availableFrom?: Date;
  availableTo?: Date;
  openNow?: boolean;
  telemedAvailable?: boolean;
  emergencyCapability?: string;
  sort?: 'soonest' | 'name' | 'distance';
  limit: number;
  petContextApplied?: boolean;
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
  distanceKm: number | null;
  telemedAvailable: boolean;
  emergencyAvailable: boolean;
  doctorCount: number;
  priceFrom: string | null;
  availability: {
    sourceUpdatedAt: string | null;
    serverNow: string;
    freshness: PublicAvailabilityFreshness;
    confirmationMode: PublicConfirmationMode;
  };
  fitReasons: string[];
};

export type PublicClinicsResponse = {
  observedAt: string;
  clinics: PublicClinicSummary[];
  personalization: { applied: boolean };
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
  sourceUpdatedAt: string | null;
  freshness: PublicAvailabilityFreshness;
  confirmationMode: PublicConfirmationMode;
  slots: Array<{
    id: string;
    startsAt: string;
    endsAt: string;
    remainingCapacity: number;
    service: { id: string | null; name: string | null };
  }>;
};

export type PublicBookingSelectionResponse = {
  location: { id: string; clinicId: string; clinicName: string; address: string; timezone: string };
  window: {
    serverNow: string;
    from: string;
    to: string;
    availableDates: string[];
    sourceUpdatedAt: string | null;
    freshness: PublicAvailabilityFreshness;
  };
  personalization: { applied: boolean; compatibility: 'NOT_EVALUATED' };
  services: Array<{
    id: string;
    code: string;
    displayName: string;
    durationMinutes: number;
    price: {
      kind: 'BASE';
      amount: string;
      currency: string;
      additionalCostsPossible: true;
      finalPriceStatus: 'CLINIC_AGREEMENT_REQUIRED';
    };
    doctorRequired: false;
  }>;
  slots: Array<{
    id: string;
    serviceId: string;
    startsAt: string;
    endsAt: string;
    timezone: string;
    availabilityState: 'AVAILABLE' | 'REQUEST_ONLY' | 'STALE';
    expectedVersion: number;
    freshness: PublicAvailabilityFreshness;
    confirmationMode: PublicConfirmationMode;
    sourceUpdatedAt: string;
    priceReference: string;
  }>;
};

export type PublicDoctorSummary = {
  id: string;
  displayName: string;
  title: 'Ветеринарный врач';
  clinic: { id: string; name: string };
  location: { id: string; address: string };
  nextAvailableAt: string | null;
  availability: {
    sourceUpdatedAt: string | null;
    serverNow: string;
    freshness: PublicAvailabilityFreshness;
    confirmationMode: PublicConfirmationMode;
  };
};

export type PublicDoctorsResponse = {
  observedAt: string;
  doctors: PublicDoctorSummary[];
  personalization: { applied: boolean };
};

@Injectable()
export class PublicCatalogService {
  constructor(private readonly database: DatabaseService) {}

  async listClinics(input: PublicCatalogFilters): Promise<PublicClinicsResponse> {
    const query = input.query?.trim() || null;
    const serviceCode = input.serviceCode?.trim().toUpperCase() || null;
    const emergencyCapability = input.emergencyCapability?.trim().toUpperCase() || null;
    const latitude = input.latitude ?? null;
    const longitude = input.longitude ?? null;
    const radiusKm = input.radiusKm ?? null;
    const availabilityFrom = input.availableFrom ?? null;
    const availabilityTo = input.availableTo ?? null;
    const onlyOpen = input.openNow === true || Boolean(availabilityFrom || availabilityTo);
    const requireTelemed = input.telemedAvailable === true;
    const sortByName = input.sort === 'name';
    const sortByDistance = input.sort === 'distance';
    const result = await this.database.query<PublicClinicRow>(`
      WITH server_time AS (SELECT clock_timestamp() AS value)
      SELECT
        clinic.id AS clinic_id,
        clinic.public_name AS clinic_name,
        COUNT(DISTINCT location.id)::text AS location_count,
        COUNT(DISTINCT service.id)::text AS service_count,
        MIN(
          CASE
            WHEN $10::double precision IS NULL OR $11::double precision IS NULL
              OR location.latitude IS NULL OR location.longitude IS NULL THEN NULL
            ELSE 6371 * acos(LEAST(1, GREATEST(-1,
              sin(radians($10::double precision)) * sin(radians(location.latitude::double precision)) +
              cos(radians($10::double precision)) * cos(radians(location.latitude::double precision)) *
              cos(radians(location.longitude::double precision) - radians($11::double precision))
            )))
          END
        )::text AS distance_km,
        BOOL_OR(service.code ILIKE 'TELEMED%' OR service.code ILIKE 'ONLINE%') AS telemed_available,
        BOOL_OR(EXISTS (
          SELECT 1
          FROM clinic_schema.emergency_capability_profiles emergency_profile
          WHERE emergency_profile.clinic_location_id = location.id
            AND emergency_profile.emergency_status = 'ACCEPTING_NOW'
            AND emergency_profile.verification_status = 'VERIFIED'
            AND emergency_profile.valid_until > server_time.value
        )) AS emergency_available,
        COUNT(DISTINCT staff.id)::text AS doctor_count,
        MIN(service.price_amount)::text AS price_from,
        MAX(slot.updated_at) FILTER (WHERE slot.state = 'OPEN') AS availability_source_updated_at,
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
      LEFT JOIN clinic_schema.clinic_staff staff ON staff.clinic_location_id = location.id
        AND staff.active = true AND staff.role = 'VETERINARIAN'
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
          $12::double precision IS NULL
          OR (
            location.latitude IS NOT NULL
            AND location.longitude IS NOT NULL
            AND 6371 * acos(LEAST(1, GREATEST(-1,
              sin(radians($10::double precision)) * sin(radians(location.latitude::double precision)) +
              cos(radians($10::double precision)) * cos(radians(location.latitude::double precision)) *
              cos(radians(location.longitude::double precision) - radians($11::double precision))
            ))) <= $12::double precision
          )
        )
        AND (
          $8::boolean = false
          OR EXISTS (
            SELECT 1
            FROM clinic_schema.clinic_services telemed_service
            WHERE telemed_service.clinic_location_id = location.id
              AND telemed_service.active = true
              AND (telemed_service.code ILIKE 'TELEMED%' OR telemed_service.code ILIKE 'ONLINE%')
          )
        )
        AND (
          $9::text IS NULL
          OR EXISTS (
            SELECT 1
            FROM clinic_schema.emergency_capability_profiles emergency_profile
            JOIN clinic_schema.emergency_capabilities emergency_capability
              ON emergency_capability.profile_id = emergency_profile.id
            WHERE emergency_profile.clinic_location_id = location.id
              AND emergency_profile.emergency_status = 'ACCEPTING_NOW'
              AND emergency_profile.verification_status = 'VERIFIED'
              AND emergency_profile.valid_until > server_time.value
              AND emergency_capability.capability_code = $9::text
          )
        )
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
        CASE WHEN $13::boolean THEN MIN(
          CASE
            WHEN $10::double precision IS NULL OR $11::double precision IS NULL
              OR location.latitude IS NULL OR location.longitude IS NULL THEN NULL
            ELSE 6371 * acos(LEAST(1, GREATEST(-1,
              sin(radians($10::double precision)) * sin(radians(location.latitude::double precision)) +
              cos(radians($10::double precision)) * cos(radians(location.latitude::double precision)) *
              cos(radians(location.longitude::double precision) - radians($11::double precision))
            )))
          END
        ) END ASC NULLS LAST,
        CASE WHEN $7::boolean THEN clinic.public_name END ASC,
        CASE WHEN NOT $7::boolean AND NOT $13::boolean THEN MIN(slot.starts_at) FILTER (
          WHERE slot.state = 'OPEN'
            AND slot.starts_at >= GREATEST(COALESCE($4::timestamptz, server_time.value), server_time.value)
            AND ($5::timestamptz IS NULL OR slot.starts_at < $5::timestamptz)
            AND slot.capacity - slot.booked_count - slot.held_count > 0
        ) END ASC NULLS LAST,
        clinic.public_name ASC,
        clinic.id ASC
      LIMIT $2
    `, [query, input.limit, serviceCode, availabilityFrom, availabilityTo, onlyOpen, sortByName, requireTelemed, emergencyCapability, latitude, longitude, radiusKm, sortByDistance]);

    return {
      observedAt: result.rows[0]?.server_now.toISOString() ?? new Date().toISOString(),
      clinics: result.rows.map((row) => this.toClinicSummary(row)),
      personalization: { applied: input.petContextApplied === true },
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
        NULL::text AS distance_km,
        BOOL_OR(service.code ILIKE 'TELEMED%' OR service.code ILIKE 'ONLINE%') AS telemed_available,
        BOOL_OR(EXISTS (
          SELECT 1
          FROM clinic_schema.emergency_capability_profiles emergency_profile
          WHERE emergency_profile.clinic_location_id = location.id
            AND emergency_profile.emergency_status = 'ACCEPTING_NOW'
            AND emergency_profile.verification_status = 'VERIFIED'
            AND emergency_profile.valid_until > server_time.value
        )) AS emergency_available,
        COUNT(DISTINCT staff.id)::text AS doctor_count,
        MIN(service.price_amount)::text AS price_from,
        MAX(slot.updated_at) FILTER (WHERE slot.state = 'OPEN') AS availability_source_updated_at,
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
      LEFT JOIN clinic_schema.clinic_staff staff ON staff.clinic_location_id = location.id
        AND staff.active = true AND staff.role = 'VETERINARIAN'
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
        slot.updated_at AS source_updated_at,
        CASE WHEN slot.source = 'MANUAL' THEN 'CLINIC_CONFIRMATION' ELSE 'ALTERNATIVE_POSSIBLE' END AS confirmation_mode,
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
    const sourceUpdatedAt = result.rows.reduce<Date | null>((latest, row) =>
      latest === null || row.source_updated_at > latest ? row.source_updated_at : latest, null);
    const serverNow = result.rows[0]?.server_now ?? new Date();
    return {
      locationId: input.locationId,
      observedAt: serverNow.toISOString(),
      sourceUpdatedAt: sourceUpdatedAt?.toISOString() ?? null,
      freshness: this.freshness(sourceUpdatedAt, serverNow, result.rows.length > 0),
      confirmationMode: result.rows[0]?.confirmation_mode ?? 'CLINIC_CONFIRMATION',
      slots: result.rows.map((row) => ({
        id: row.id,
        startsAt: row.starts_at.toISOString(),
        endsAt: row.ends_at.toISOString(),
        remainingCapacity: Number(row.remaining_capacity),
        service: { id: row.service_id, name: row.service_name },
      })),
    };
  }

  async readBookingSelection(input: {
    locationId: string;
    from: Date;
    to: Date;
    limit: number;
    serviceId?: string;
    doctorId?: string;
    petContextApplied: boolean;
  }): Promise<PublicBookingSelectionResponse | undefined> {
    const locationResult = await this.database.query<BookingSelectionLocationRow>(`
      SELECT clinic.id AS clinic_id, clinic.public_name AS clinic_name,
             location.id AS location_id, location.address, clinic.timezone,
             clock_timestamp() AS server_now
      FROM clinic_schema.clinic_locations location
      JOIN clinic_schema.clinics clinic ON clinic.id = location.clinic_id
      WHERE location.id = $1::uuid
        AND location.status = 'ACTIVE'
        AND clinic.status = 'ACTIVE'
      LIMIT 1
    `, [input.locationId]);
    const location = locationResult.rows[0];
    if (!location) return undefined;

    const serviceResult = await this.database.query<PublicServiceRow>(`
      SELECT id, code, display_name, duration_minutes,
             price_amount::text AS price_amount, currency
      FROM clinic_schema.clinic_services
      WHERE clinic_location_id = $1::uuid
        AND active = true
        AND ($2::uuid IS NULL OR id = $2::uuid)
      ORDER BY display_name ASC, code ASC, id ASC
    `, [input.locationId, input.serviceId ?? null]);

    const slotResult = await this.database.query<BookingSelectionSlotRow>(`
      SELECT slot.id, slot.service_id, slot.starts_at, slot.ends_at,
             slot.version, slot.updated_at AS source_updated_at,
             CASE WHEN slot.source = 'MANUAL'
               THEN 'CLINIC_CONFIRMATION'
               ELSE 'ALTERNATIVE_POSSIBLE'
             END AS confirmation_mode,
             to_char(slot.starts_at AT TIME ZONE $6::text, 'YYYY-MM-DD') AS available_date,
             to_char(slot.starts_at AT TIME ZONE $6::text, 'HH24:MI') AS local_time
      FROM clinic_schema.appointment_slots slot
      JOIN clinic_schema.clinic_services service
        ON service.id = slot.service_id
       AND service.clinic_location_id = slot.clinic_location_id
       AND service.active = true
      LEFT JOIN clinic_schema.clinic_staff staff ON staff.id = slot.staff_id
      WHERE slot.clinic_location_id = $1::uuid
        AND slot.state = 'OPEN'
        AND slot.starts_at >= GREATEST($2::timestamptz, $7::timestamptz)
        AND slot.starts_at < $3::timestamptz
        AND slot.capacity - slot.booked_count - slot.held_count > 0
        AND ($4::uuid IS NULL OR slot.service_id = $4::uuid)
        AND ($5::uuid IS NULL OR (
          slot.staff_id = $5::uuid
          AND staff.active = true
          AND staff.role = 'VETERINARIAN'
        ))
      ORDER BY slot.starts_at ASC, slot.id ASC
      LIMIT $8
    `, [input.locationId, input.from, input.to, input.serviceId ?? null,
      input.doctorId ?? null, location.timezone, location.server_now, input.limit]);

    const sourceUpdatedAt = slotResult.rows.reduce<Date | null>((latest, row) =>
      latest === null || row.source_updated_at > latest ? row.source_updated_at : latest, null);
    const envelopeFreshness = this.freshness(sourceUpdatedAt, location.server_now, slotResult.rows.length > 0);
    return {
      location: {
        id: location.location_id,
        clinicId: location.clinic_id,
        clinicName: location.clinic_name,
        address: location.address,
        timezone: location.timezone,
      },
      window: {
        serverNow: location.server_now.toISOString(),
        from: input.from.toISOString(),
        to: input.to.toISOString(),
        availableDates: [...new Set(slotResult.rows.map((row) => row.available_date))],
        sourceUpdatedAt: sourceUpdatedAt?.toISOString() ?? null,
        freshness: envelopeFreshness,
      },
      personalization: {
        applied: input.petContextApplied,
        compatibility: 'NOT_EVALUATED',
      },
      services: serviceResult.rows.map((row) => ({
        id: row.id,
        code: row.code,
        displayName: row.display_name,
        durationMinutes: row.duration_minutes,
        price: {
          kind: 'BASE',
          amount: row.price_amount,
          currency: row.currency,
          additionalCostsPossible: true,
          finalPriceStatus: 'CLINIC_AGREEMENT_REQUIRED',
        },
        doctorRequired: false,
      })),
      slots: slotResult.rows.map((row) => {
        const freshness = this.freshness(row.source_updated_at, location.server_now, true);
        return {
          id: row.id,
          serviceId: row.service_id,
          startsAt: row.starts_at.toISOString(),
          endsAt: row.ends_at.toISOString(),
          localDate: row.available_date,
          localTime: row.local_time,
          timezone: location.timezone,
          availabilityState: freshness === 'STALE'
            ? 'STALE'
            : row.confirmation_mode === 'ALTERNATIVE_POSSIBLE' ? 'REQUEST_ONLY' : 'AVAILABLE',
          expectedVersion: row.version,
          freshness,
          confirmationMode: row.confirmation_mode,
          sourceUpdatedAt: row.source_updated_at.toISOString(),
          priceReference: `service:${row.service_id}`,
        };
      }),
    };
  }

  async listDoctors(input: {
    clinicId: string;
    locationId?: string;
    serviceCode?: string;
    doctorId?: string;
    limit: number;
    petContextApplied?: boolean;
  }): Promise<PublicDoctorsResponse> {
    const result = await this.database.query<PublicDoctorRow>(`
      WITH server_time AS (SELECT clock_timestamp() AS value)
      SELECT
        staff.id AS doctor_id,
        staff.display_name,
        clinic.id AS clinic_id,
        clinic.public_name AS clinic_name,
        location.id AS location_id,
        location.address,
        MIN(slot.starts_at) FILTER (
          WHERE slot.state = 'OPEN'
            AND slot.starts_at > server_time.value
            AND slot.capacity - slot.booked_count - slot.held_count > 0
        ) AS next_available_at,
        MAX(slot.updated_at) FILTER (WHERE slot.state = 'OPEN') AS source_updated_at,
        server_time.value AS server_now
      FROM clinic_schema.clinic_staff staff
      JOIN clinic_schema.clinic_locations location
        ON location.id = staff.clinic_location_id AND location.status = 'ACTIVE'
      JOIN clinic_schema.clinics clinic
        ON clinic.id = location.clinic_id AND clinic.status = 'ACTIVE'
      LEFT JOIN clinic_schema.appointment_slots slot
        ON slot.staff_id = staff.id
      LEFT JOIN clinic_schema.clinic_services service
        ON service.id = slot.service_id AND service.active = true
      CROSS JOIN server_time
      WHERE staff.active = true
        AND staff.role = 'VETERINARIAN'
        AND clinic.id = $1::uuid
        AND ($2::uuid IS NULL OR location.id = $2::uuid)
        AND ($3::text IS NULL OR service.code = $3::text)
        AND ($4::uuid IS NULL OR staff.id = $4::uuid)
      GROUP BY staff.id, staff.display_name, clinic.id, clinic.public_name,
               location.id, location.address, server_time.value
      ORDER BY next_available_at ASC NULLS LAST, staff.display_name ASC, staff.id ASC
      LIMIT $5
    `, [
      input.clinicId,
      input.locationId ?? null,
      input.serviceCode?.trim().toUpperCase() || null,
      input.doctorId ?? null,
      input.limit,
    ]);
    return {
      observedAt: result.rows[0]?.server_now.toISOString() ?? new Date().toISOString(),
      doctors: result.rows.map((row) => this.toDoctor(row)),
      personalization: { applied: input.petContextApplied === true },
    };
  }

  async readDoctor(doctorId: string): Promise<PublicDoctorSummary | undefined> {
    const result = await this.database.query<PublicDoctorRow>(`
      WITH server_time AS (SELECT clock_timestamp() AS value)
      SELECT
        staff.id AS doctor_id, staff.display_name,
        clinic.id AS clinic_id, clinic.public_name AS clinic_name,
        location.id AS location_id, location.address,
        MIN(slot.starts_at) FILTER (
          WHERE slot.state = 'OPEN' AND slot.starts_at > server_time.value
            AND slot.capacity - slot.booked_count - slot.held_count > 0
        ) AS next_available_at,
        MAX(slot.updated_at) FILTER (WHERE slot.state = 'OPEN') AS source_updated_at,
        server_time.value AS server_now
      FROM clinic_schema.clinic_staff staff
      JOIN clinic_schema.clinic_locations location
        ON location.id = staff.clinic_location_id AND location.status = 'ACTIVE'
      JOIN clinic_schema.clinics clinic
        ON clinic.id = location.clinic_id AND clinic.status = 'ACTIVE'
      LEFT JOIN clinic_schema.appointment_slots slot ON slot.staff_id = staff.id
      CROSS JOIN server_time
      WHERE staff.id = $1::uuid AND staff.active = true AND staff.role = 'VETERINARIAN'
      GROUP BY staff.id, staff.display_name, clinic.id, clinic.public_name,
               location.id, location.address, server_time.value
      LIMIT 1
    `, [doctorId]);
    return result.rows[0] ? this.toDoctor(result.rows[0]) : undefined;
  }

  private toClinicSummary(row: PublicClinicRow): PublicClinicSummary {
    const serviceCount = Number(row.service_count);
    const doctorCount = Number(row.doctor_count ?? 0);
    const freshness = this.freshness(
      row.availability_source_updated_at ?? null,
      row.server_now,
      row.next_available_at !== null,
    );
    const fitReasons: string[] = [];
    if (row.next_available_at) fitReasons.push('Есть ближайшее подтверждаемое окно');
    if (serviceCount > 0) fitReasons.push('Доступны подтверждённые услуги');
    if (doctorCount > 0) fitReasons.push('Есть ветеринарные специалисты');
    if (row.emergency_available) fitReasons.push('Экстренная возможность проверена');
    return {
      id: row.clinic_id,
      name: row.clinic_name,
      locationCount: Number(row.location_count),
      serviceCount,
      nextAvailableAt: row.next_available_at?.toISOString() ?? null,
      distanceKm: row.distance_km === null ? null : Number(Number(row.distance_km).toFixed(1)),
      telemedAvailable: row.telemed_available,
      emergencyAvailable: row.emergency_available,
      doctorCount,
      priceFrom: row.price_from ?? null,
      availability: {
        sourceUpdatedAt: row.availability_source_updated_at?.toISOString() ?? null,
        serverNow: row.server_now.toISOString(),
        freshness,
        confirmationMode: 'CLINIC_CONFIRMATION',
      },
      fitReasons: fitReasons.slice(0, 4),
    };
  }

  private toDoctor(row: PublicDoctorRow): PublicDoctorSummary {
    return {
      id: row.doctor_id,
      displayName: row.display_name,
      title: 'Ветеринарный врач',
      clinic: { id: row.clinic_id, name: row.clinic_name },
      location: { id: row.location_id, address: row.address },
      nextAvailableAt: row.next_available_at?.toISOString() ?? null,
      availability: {
        sourceUpdatedAt: row.source_updated_at?.toISOString() ?? null,
        serverNow: row.server_now.toISOString(),
        freshness: this.freshness(row.source_updated_at, row.server_now, row.next_available_at !== null),
        confirmationMode: 'CLINIC_CONFIRMATION',
      },
    };
  }

  private freshness(sourceUpdatedAt: Date | null, serverNow: Date, available: boolean): PublicAvailabilityFreshness {
    if (!available || sourceUpdatedAt === null) return 'UNAVAILABLE';
    const ageMinutes = Math.max(0, serverNow.getTime() - sourceUpdatedAt.getTime()) / 60000;
    if (ageMinutes <= 15) return 'CURRENT';
    if (ageMinutes <= 60) return 'AGING';
    return 'STALE';
  }
}
