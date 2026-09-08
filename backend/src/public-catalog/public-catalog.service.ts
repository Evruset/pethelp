import { Injectable } from '@nestjs/common';
import type { OwnerSpecialistAvailabilitySlotDto, OwnerSpecialistDiscoveryDoctorDto } from './owner-clinic-catalog.dto';
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

type OwnerClinicServiceRow = {
  clinic_id: string;
  clinic_name: string;
  location_id: string;
  address: string;
  phone: string | null;
  service_id: string | null;
  service_name: string | null;
  price_amount: string | null;
  currency: string | null;
  server_now: Date;
};

type OwnerAvailabilityRow = {
  clinic_name: string;
  service_name: string;
  timezone: string;
  server_now: Date;
  horizon_ends_at: Date;
  slot_id: string | null;
  starts_at: Date | null;
  ends_at: Date | null;
  local_date: string | null;
  local_time: string | null;
  version: number | null;
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
  latitude: number | string | null;
  longitude: number | string | null;
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
    localDate: string;
    localTime: string;
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

type OwnerSpecialistDiscoveryRow = {
  server_now: Date;
  specialty_id: string;
  specialty_name: string;
  doctor_id: string;
  doctor_name: string;
  service_id: string;
  service_code: string;
  service_name: string;
  clinic_id: string;
  clinic_name: string;
  location_id: string;
  address: string;
  timezone: string;
  latitude: number | string | null;
  longitude: number | string | null;
  slot_id: string;
  starts_at: Date;
  ends_at: Date;
  version: number;
};

type OwnerSpecialistOptionRow = {
  server_now: Date;
  option_kind: 'SPECIALTY' | 'SERVICE';
  option_id: string | null;
  option_code: string | null;
  option_name: string;
  specialty_id: string | null;
};

@Injectable()
export class PublicCatalogService {
  constructor(private readonly database: DatabaseService) {}

  async readOwnerSpecialistDiscoveryOptions() {
    const result = await this.database.query<OwnerSpecialistOptionRow>(`
      WITH server_time AS (SELECT clock_timestamp() AS value), eligible AS (
        SELECT DISTINCT specialty.id AS specialty_id, specialty.name AS specialty_name,
          service.id AS service_id, upper(service.code) AS service_code,
          service.display_name AS service_name
        FROM clinic_schema.doctor_services eligibility
        JOIN catalog_schema.doctors doctor
          ON doctor.id=eligibility.doctor_id AND doctor.clinic_location_id=eligibility.clinic_location_id
         AND doctor.active AND doctor.public_booking_enabled
        JOIN LATERAL (
          SELECT event.event_type
          FROM catalog_schema.doctor_public_profile_consent_events event
          WHERE event.doctor_id=doctor.id AND event.clinic_location_id=eligibility.clinic_location_id
          ORDER BY event.occurred_at DESC,event.id DESC LIMIT 1
        ) public_consent ON public_consent.event_type='CONSENT_GRANTED'
        JOIN clinic_schema.clinic_services service
          ON service.id=eligibility.service_id AND service.clinic_location_id=eligibility.clinic_location_id AND service.active
        JOIN catalog_schema.specialty_services taxonomy
          ON taxonomy.service_id=service.id AND taxonomy.active
        JOIN catalog_schema.specialties specialty ON specialty.id=taxonomy.specialty_id
        JOIN clinic_schema.clinic_locations location
          ON location.id=eligibility.clinic_location_id AND location.status='ACTIVE'
        JOIN clinic_schema.clinics clinic ON clinic.id=location.clinic_id AND clinic.status='ACTIVE'
        JOIN clinic_schema.clinic_staff staff
          ON staff.id=eligibility.staff_id AND staff.clinic_location_id=location.id
         AND staff.active AND staff.role='VETERINARIAN' AND staff.catalog_doctor_id=doctor.id
        JOIN clinic_schema.appointment_slots slot
          ON slot.doctor_service_id=eligibility.id AND slot.doctor_id=doctor.id
         AND slot.staff_id=staff.id AND slot.service_id=service.id
         AND slot.resource_id IS NOT DISTINCT FROM eligibility.resource_id
         AND slot.clinic_location_id=location.id AND slot.source='DOCTOR_SHIFT'
         AND slot.state='OPEN' AND slot.publication_state='PUBLISHED'
         AND slot.starts_at >= (SELECT value FROM server_time)
         AND slot.capacity-slot.booked_count-slot.held_count > 0
        JOIN clinic_schema.doctor_shifts shift
          ON shift.id=slot.doctor_shift_id AND shift.doctor_id=doctor.id
         AND shift.clinic_location_id=location.id AND shift.status='PUBLISHED'
        JOIN clinic_schema.inventory_generation_runs run
          ON run.id=slot.generation_run_id AND run.doctor_shift_id=shift.id AND run.status='PUBLISHED'
        WHERE eligibility.active AND (eligibility.resource_id IS NULL OR EXISTS (
          SELECT 1 FROM clinic_schema.clinic_resources resource
          WHERE resource.id=eligibility.resource_id
            AND resource.clinic_location_id=location.id AND resource.active
        ))
      ), specialty_options AS (
        SELECT specialty_id, MIN(specialty_name) AS option_name
        FROM eligible GROUP BY specialty_id
        ORDER BY MIN(specialty_name), specialty_id LIMIT 100
      ), service_options AS (
        SELECT service_id, specialty_id, service_code, service_name AS option_name
        FROM eligible GROUP BY service_id, specialty_id, service_code, service_name
        ORDER BY service_name, service_id LIMIT 100
      )
      SELECT server_time.value AS server_now, 'SPECIALTY'::text AS option_kind,
        specialty_id::text AS option_id, NULL::text AS option_code, option_name,
        specialty_id::text AS specialty_id
      FROM specialty_options CROSS JOIN server_time
      UNION ALL
      SELECT server_time.value AS server_now, 'SERVICE'::text AS option_kind,
        service_id::text AS option_id, service_code AS option_code, option_name,
        specialty_id::text AS specialty_id
      FROM service_options CROSS JOIN server_time
      ORDER BY option_kind, option_name, option_id, option_code
    `);
    const specialties = new Map<string, { specialtyId: string; name: string }>();
    const services = new Map<string, { serviceId: string; specialtyId: string; serviceCode: string; name: string }>();
    for (const row of result.rows) {
      if (row.option_kind === 'SPECIALTY' && row.option_id) specialties.set(row.option_id, { specialtyId: row.option_id, name: row.option_name });
      if (row.option_kind === 'SERVICE' && row.option_id && row.specialty_id && row.option_code) services.set(row.option_id, { serviceId: row.option_id, specialtyId: row.specialty_id, serviceCode: row.option_code, name: row.option_name });
    }
    return {
      observedAt: result.rows[0]?.server_now.toISOString() ?? new Date().toISOString(),
      specialties: [...specialties.values()].sort((a,b)=>a.name.localeCompare(b.name,'ru')||a.specialtyId.localeCompare(b.specialtyId)).slice(0,100),
      services: [...services.values()].sort((a,b)=>a.name.localeCompare(b.name,'ru')||a.serviceId.localeCompare(b.serviceId)).slice(0,100),
    };
  }

  async readOwnerSpecialistDiscovery(input: { specialtyId?: string; serviceCode?: string; serviceId?: string; limit: number }) {
    const result = await this.database.query<OwnerSpecialistDiscoveryRow>(`
      WITH server_time AS (SELECT clock_timestamp() AS value),
      candidates AS (
        SELECT specialty.id AS specialty_id,
          specialty.name AS specialty_name, doctor.id AS doctor_id,
          doctor.full_name AS doctor_name, service.id AS service_id,
          service.code AS service_code, service.display_name AS service_name,
          clinic.id AS clinic_id, clinic.public_name AS clinic_name,
          location.id AS location_id, location.address, location.timezone,
          CASE WHEN location.latitude BETWEEN -90 AND 90 THEN location.latitude::double precision ELSE NULL END AS latitude,
          CASE WHEN location.longitude BETWEEN -180 AND 180 THEN location.longitude::double precision ELSE NULL END AS longitude,
          MIN(slot.starts_at) AS first_available_at
        FROM clinic_schema.doctor_services eligibility
        JOIN catalog_schema.doctors doctor
          ON doctor.id=eligibility.doctor_id AND doctor.clinic_location_id=eligibility.clinic_location_id
         AND doctor.active AND doctor.public_booking_enabled
        JOIN LATERAL (
          SELECT event.event_type
          FROM catalog_schema.doctor_public_profile_consent_events event
          WHERE event.doctor_id=doctor.id AND event.clinic_location_id=eligibility.clinic_location_id
          ORDER BY event.occurred_at DESC,event.id DESC LIMIT 1
        ) public_consent ON public_consent.event_type='CONSENT_GRANTED'
        JOIN clinic_schema.clinic_services service
          ON service.id=eligibility.service_id AND service.clinic_location_id=eligibility.clinic_location_id AND service.active
        JOIN catalog_schema.specialty_services taxonomy
          ON taxonomy.service_id=service.id AND taxonomy.active
        JOIN catalog_schema.specialties specialty ON specialty.id=taxonomy.specialty_id
        JOIN clinic_schema.clinic_locations location
          ON location.id=eligibility.clinic_location_id AND location.status='ACTIVE'
        JOIN clinic_schema.clinics clinic ON clinic.id=location.clinic_id AND clinic.status='ACTIVE'
        JOIN clinic_schema.clinic_staff staff
          ON staff.id=eligibility.staff_id AND staff.clinic_location_id=location.id
         AND staff.active AND staff.role='VETERINARIAN' AND staff.catalog_doctor_id=doctor.id
        JOIN clinic_schema.appointment_slots slot
          ON slot.doctor_service_id=eligibility.id AND slot.doctor_id=doctor.id
         AND slot.staff_id=staff.id AND slot.service_id=service.id
         AND slot.resource_id IS NOT DISTINCT FROM eligibility.resource_id
         AND slot.clinic_location_id=location.id AND slot.source='DOCTOR_SHIFT'
         AND slot.state='OPEN' AND slot.publication_state='PUBLISHED'
         AND slot.starts_at >= (SELECT value FROM server_time)
         AND slot.capacity-slot.booked_count-slot.held_count > 0
        JOIN clinic_schema.doctor_shifts shift
          ON shift.id=slot.doctor_shift_id AND shift.doctor_id=doctor.id
         AND shift.clinic_location_id=location.id AND shift.status='PUBLISHED'
        JOIN clinic_schema.inventory_generation_runs run
          ON run.id=slot.generation_run_id AND run.doctor_shift_id=shift.id
         AND run.status='PUBLISHED'
        WHERE eligibility.active
          AND (eligibility.resource_id IS NULL OR EXISTS (
            SELECT 1 FROM clinic_schema.clinic_resources resource
            WHERE resource.id=eligibility.resource_id
              AND resource.clinic_location_id=location.id AND resource.active
          ))
          AND ($1::uuid IS NULL OR specialty.id=$1::uuid)
          AND ($2::text IS NULL OR upper(service.code)=$2::text)
          AND ($3::uuid IS NULL OR service.id=$3::uuid)
        GROUP BY specialty.id, specialty.name, doctor.id,
          doctor.full_name, service.id, service.code, service.display_name,
          clinic.id, clinic.public_name, location.id, location.address, location.timezone,
          location.latitude, location.longitude
        ORDER BY MIN(slot.starts_at), specialty.name, doctor.full_name,
          clinic.public_name, location.address, doctor.id, service.id
        LIMIT $4
      )
      SELECT server_time.value AS server_now, candidate.*, slot.id AS slot_id,
        slot.starts_at, slot.ends_at, slot.version
      FROM candidates candidate CROSS JOIN server_time
      JOIN LATERAL (
        SELECT available.id, available.starts_at, available.ends_at, available.version
        FROM clinic_schema.appointment_slots available
        JOIN clinic_schema.doctor_services eligibility
          ON eligibility.id=available.doctor_service_id AND eligibility.active
         AND eligibility.doctor_id=candidate.doctor_id
         AND eligibility.service_id=candidate.service_id
         AND eligibility.clinic_location_id=candidate.location_id
         AND eligibility.resource_id IS NOT DISTINCT FROM available.resource_id
        JOIN clinic_schema.clinic_staff staff
          ON staff.id=eligibility.staff_id AND staff.id=available.staff_id
         AND staff.clinic_location_id=candidate.location_id AND staff.active
         AND staff.role='VETERINARIAN' AND staff.catalog_doctor_id=candidate.doctor_id
        JOIN clinic_schema.doctor_shifts shift
          ON shift.id=available.doctor_shift_id AND shift.status='PUBLISHED'
         AND shift.doctor_id=candidate.doctor_id
         AND shift.clinic_location_id=candidate.location_id
        JOIN clinic_schema.inventory_generation_runs run
          ON run.id=available.generation_run_id AND run.status='PUBLISHED'
         AND run.doctor_shift_id=shift.id
        WHERE available.doctor_id=candidate.doctor_id
          AND available.service_id=candidate.service_id
          AND available.clinic_location_id=candidate.location_id
          AND available.source='DOCTOR_SHIFT' AND available.state='OPEN'
          AND available.publication_state='PUBLISHED'
          AND available.starts_at >= server_time.value
          AND available.capacity-available.booked_count-available.held_count > 0
          AND (eligibility.resource_id IS NULL OR EXISTS (
            SELECT 1 FROM clinic_schema.clinic_resources resource
            WHERE resource.id=eligibility.resource_id
              AND resource.clinic_location_id=candidate.location_id AND resource.active
          ))
        ORDER BY available.starts_at, available.id
        LIMIT 5
      ) slot ON true
      ORDER BY candidate.first_available_at, candidate.specialty_name,
        candidate.doctor_name, candidate.clinic_name, candidate.address,
        candidate.doctor_id, candidate.service_id, slot.starts_at, slot.id
    `, [input.specialtyId ?? null, input.serviceCode ?? null, input.serviceId ?? null, input.limit]);
    const observedAt = result.rows[0]?.server_now.toISOString() ?? new Date().toISOString();
    const doctors = new Map<string, Omit<OwnerSpecialistDiscoveryDoctorDto, 'slots'> & { slots: OwnerSpecialistAvailabilitySlotDto[] }>();
    for (const row of result.rows) {
      const projectionKey = `${row.doctor_id}:${row.service_id}`;
      let doctor = doctors.get(projectionKey);
      if (!doctor) {
        doctor = {
          specialtyId: row.specialty_id, specialtyName: row.specialty_name,
          doctorId: row.doctor_id, doctorName: row.doctor_name,
          serviceId: row.service_id, serviceCode: row.service_code,
          serviceName: row.service_name, clinicId: row.clinic_id,
          clinicName: row.clinic_name, locationId: row.location_id,
          address: row.address, timezone: row.timezone,
          latitude: row.latitude === null ? null : Number(row.latitude),
          longitude: row.longitude === null ? null : Number(row.longitude), slots: [],
        };
        doctors.set(projectionKey, doctor);
      }
      doctor.slots.push({ slotId: row.slot_id, startsAt: row.starts_at.toISOString(), endsAt: row.ends_at.toISOString(), expectedVersion: row.version });
    }
    return { observedAt, limit: input.limit, doctors: [...doctors.values()] };
  }

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
        MAX(slot.updated_at) FILTER (WHERE slot.state = 'OPEN' AND slot.publication_state = 'PUBLISHED') AS availability_source_updated_at,
        MIN(slot.starts_at) FILTER (
          WHERE slot.state = 'OPEN' AND slot.publication_state = 'PUBLISHED'
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
              AND available_slot.state = 'OPEN' AND available_slot.publication_state = 'PUBLISHED'
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
          WHERE slot.state = 'OPEN' AND slot.publication_state = 'PUBLISHED'
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
        MAX(slot.updated_at) FILTER (WHERE slot.state = 'OPEN' AND slot.publication_state = 'PUBLISHED') AS availability_source_updated_at,
        MIN(slot.starts_at) FILTER (
          WHERE slot.state = 'OPEN' AND slot.publication_state = 'PUBLISHED'
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
            AND slot.state = 'OPEN' AND slot.publication_state = 'PUBLISHED'
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
              AND slot.state = 'OPEN' AND slot.publication_state = 'PUBLISHED'
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

  async readOwnerClinicServices(clinicId: string, locationId: string) {
    const result = await this.database.query<OwnerClinicServiceRow>(`
      WITH server_time AS (SELECT clock_timestamp() AS value)
      SELECT clinic.id AS clinic_id, clinic.public_name AS clinic_name,
        location.id AS location_id, location.address, location.phone,
        service.id AS service_id, service.display_name AS service_name,
        service.price_amount::text AS price_amount, service.currency,
        server_time.value AS server_now
      FROM clinic_schema.clinics clinic
      JOIN clinic_schema.clinic_locations location
        ON location.clinic_id = clinic.id AND location.status = 'ACTIVE'
      CROSS JOIN server_time
      LEFT JOIN clinic_schema.clinic_services service
        ON service.clinic_location_id = location.id AND service.active = true
      WHERE clinic.id = $1::uuid AND location.id = $2::uuid
        AND clinic.status = 'ACTIVE'
      ORDER BY service.display_name ASC, service.id ASC
    `, [clinicId, locationId]);
    const first = result.rows[0];
    if (!first) return undefined;
    return {
      observedAt: first.server_now.toISOString(), clinicId: first.clinic_id,
      locationId: first.location_id, name: first.clinic_name,
      address: first.address, phone: first.phone,
      services: result.rows.flatMap((row) => row.service_id && row.service_name && row.price_amount && row.currency
        ? [{ serviceId: row.service_id, name: row.service_name, price: { kind: 'INFORMATIONAL' as const, amount: row.price_amount, currency: row.currency.trim() } }]
        : []),
    };
  }

  async readOwnerAvailability(clinicId: string, locationId: string, serviceId: string) {
    const result = await this.database.query<OwnerAvailabilityRow>(`
      WITH server_time AS (
        SELECT clock_timestamp() AS value
      )
      SELECT clinic.public_name AS clinic_name, service.display_name AS service_name,
        location.timezone, server_time.value AS server_now,
        server_time.value + interval '14 days' AS horizon_ends_at,
        slot.id AS slot_id, slot.starts_at, slot.ends_at,
        to_char(slot.starts_at AT TIME ZONE location.timezone, 'YYYY-MM-DD') AS local_date,
        to_char(slot.starts_at AT TIME ZONE location.timezone, 'HH24:MI') AS local_time,
        slot.version
      FROM clinic_schema.clinics clinic
      JOIN clinic_schema.clinic_locations location
        ON location.clinic_id = clinic.id AND location.status = 'ACTIVE'
      JOIN clinic_schema.clinic_services service
        ON service.clinic_location_id = location.id AND service.active = true
      CROSS JOIN server_time
      LEFT JOIN clinic_schema.appointment_slots slot
        ON slot.clinic_location_id = location.id
       AND slot.service_id = service.id
       AND slot.state = 'OPEN' AND slot.publication_state = 'PUBLISHED'
       AND slot.starts_at >= server_time.value
       AND slot.starts_at < server_time.value + interval '14 days'
       AND slot.capacity - slot.booked_count - slot.held_count > 0
       AND (slot.doctor_shift_id IS NULL OR EXISTS (
         SELECT 1 FROM clinic_schema.doctor_shifts shift
         JOIN clinic_schema.doctor_services eligibility
           ON eligibility.id=slot.doctor_service_id AND eligibility.active
          AND eligibility.staff_id=slot.staff_id AND eligibility.doctor_id=slot.doctor_id
          AND eligibility.service_id=slot.service_id
         JOIN clinic_schema.clinic_staff staff
           ON staff.id=slot.staff_id AND staff.active AND staff.role='VETERINARIAN'
          AND staff.catalog_doctor_id=slot.doctor_id
         JOIN catalog_schema.doctors doctor
           ON doctor.id=slot.doctor_id AND doctor.active AND doctor.public_booking_enabled
         WHERE shift.id=slot.doctor_shift_id AND shift.status='PUBLISHED'
           AND (eligibility.resource_id IS NULL OR EXISTS (SELECT 1 FROM clinic_schema.clinic_resources resource WHERE resource.id=eligibility.resource_id AND resource.clinic_location_id=slot.clinic_location_id AND resource.active))
       ))
      WHERE clinic.id = $1::uuid AND location.id = $2::uuid
        AND service.id = $3::uuid AND clinic.status = 'ACTIVE'
      ORDER BY slot.starts_at ASC, slot.id ASC
      LIMIT 50
    `, [clinicId, locationId, serviceId]);
    const first = result.rows[0];
    if (!first) return undefined;
    return {
      observedAt: first.server_now.toISOString(),
      clinicName: first.clinic_name,
      serviceName: first.service_name,
      timezone: first.timezone,
      horizonEndsAt: first.horizon_ends_at.toISOString(),
      slots: result.rows.flatMap((row) => row.slot_id && row.starts_at && row.ends_at && row.local_date && row.local_time && row.version
        ? [{ slotId: row.slot_id, startsAt: row.starts_at.toISOString(), endsAt: row.ends_at.toISOString(), localDate: row.local_date, localTime: row.local_time, expectedVersion: row.version }]
        : []),
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
        CASE WHEN slot.source IN ('MANUAL','DOCTOR_SHIFT') THEN 'CLINIC_CONFIRMATION' ELSE 'ALTERNATIVE_POSSIBLE' END AS confirmation_mode,
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
        AND slot.publication_state = 'PUBLISHED'
        AND slot.starts_at >= GREATEST($2::timestamptz, server_time.value)
        AND slot.starts_at < $3::timestamptz
        AND slot.capacity - slot.booked_count - slot.held_count > 0
        AND (slot.doctor_shift_id IS NULL OR EXISTS (
          SELECT 1 FROM clinic_schema.doctor_shifts shift
          JOIN clinic_schema.doctor_services eligibility ON eligibility.id=slot.doctor_service_id AND eligibility.active
          JOIN clinic_schema.clinic_staff staff ON staff.id=slot.staff_id AND staff.active AND staff.role='VETERINARIAN' AND staff.catalog_doctor_id=slot.doctor_id
          JOIN catalog_schema.doctors doctor ON doctor.id=slot.doctor_id AND doctor.active AND doctor.public_booking_enabled
          WHERE shift.id=slot.doctor_shift_id AND shift.status='PUBLISHED'
            AND (eligibility.resource_id IS NULL OR EXISTS (SELECT 1 FROM clinic_schema.clinic_resources resource WHERE resource.id=eligibility.resource_id AND resource.clinic_location_id=slot.clinic_location_id AND resource.active))
        ))
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
             CASE WHEN slot.source IN ('MANUAL','DOCTOR_SHIFT')
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
        AND slot.publication_state = 'PUBLISHED'
        AND slot.starts_at >= GREATEST($2::timestamptz, $7::timestamptz)
        AND slot.starts_at < $3::timestamptz
        AND slot.capacity - slot.booked_count - slot.held_count > 0
        AND (slot.doctor_shift_id IS NULL OR EXISTS (
          SELECT 1 FROM clinic_schema.doctor_shifts shift
          JOIN clinic_schema.doctor_services eligibility ON eligibility.id=slot.doctor_service_id AND eligibility.active
            AND eligibility.staff_id=slot.staff_id AND eligibility.doctor_id=slot.doctor_id AND eligibility.service_id=slot.service_id
          JOIN clinic_schema.clinic_staff generated_staff ON generated_staff.id=slot.staff_id AND generated_staff.active AND generated_staff.role='VETERINARIAN' AND generated_staff.catalog_doctor_id=slot.doctor_id
          JOIN catalog_schema.doctors doctor ON doctor.id=slot.doctor_id AND doctor.active AND doctor.public_booking_enabled
          WHERE shift.id=slot.doctor_shift_id AND shift.status='PUBLISHED'
            AND (eligibility.resource_id IS NULL OR EXISTS (SELECT 1 FROM clinic_schema.clinic_resources resource WHERE resource.id=eligibility.resource_id AND resource.clinic_location_id=slot.clinic_location_id AND resource.active))
        ))
        AND ($4::uuid IS NULL OR slot.service_id = $4::uuid)
        AND ($5::uuid IS NULL OR (
          slot.staff_id = $5::uuid
          AND staff.active = true
          AND staff.role = 'VETERINARIAN'
          AND EXISTS (
            SELECT 1 FROM LATERAL (
              SELECT event.event_type
              FROM catalog_schema.doctor_public_profile_consent_events event
              WHERE event.doctor_id=staff.catalog_doctor_id
                AND event.clinic_location_id=slot.clinic_location_id
              ORDER BY event.occurred_at DESC,event.id DESC LIMIT 1
            ) public_consent
            WHERE public_consent.event_type='CONSENT_GRANTED'
          )
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
          WHERE slot.state = 'OPEN' AND slot.publication_state = 'PUBLISHED'
            AND slot.starts_at > server_time.value
            AND slot.capacity - slot.booked_count - slot.held_count > 0
        ) AS next_available_at,
        MAX(slot.updated_at) FILTER (WHERE slot.state = 'OPEN' AND slot.publication_state = 'PUBLISHED') AS source_updated_at,
        server_time.value AS server_now
      FROM clinic_schema.clinic_staff staff
      JOIN clinic_schema.clinic_locations location
        ON location.id = staff.clinic_location_id AND location.status = 'ACTIVE'
      JOIN clinic_schema.clinics clinic
        ON clinic.id = location.clinic_id AND clinic.status = 'ACTIVE'
      JOIN LATERAL (
        SELECT event.event_type
        FROM catalog_schema.doctor_public_profile_consent_events event
        WHERE event.doctor_id=staff.catalog_doctor_id
          AND event.clinic_location_id=staff.clinic_location_id
        ORDER BY event.occurred_at DESC,event.id DESC LIMIT 1
      ) public_consent ON public_consent.event_type='CONSENT_GRANTED'
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
          WHERE slot.state = 'OPEN' AND slot.publication_state = 'PUBLISHED' AND slot.starts_at > server_time.value
            AND slot.capacity - slot.booked_count - slot.held_count > 0
        ) AS next_available_at,
        MAX(slot.updated_at) FILTER (WHERE slot.state = 'OPEN' AND slot.publication_state = 'PUBLISHED') AS source_updated_at,
        server_time.value AS server_now
      FROM clinic_schema.clinic_staff staff
      JOIN clinic_schema.clinic_locations location
        ON location.id = staff.clinic_location_id AND location.status = 'ACTIVE'
      JOIN clinic_schema.clinics clinic
        ON clinic.id = location.clinic_id AND clinic.status = 'ACTIVE'
      JOIN LATERAL (
        SELECT event.event_type
        FROM catalog_schema.doctor_public_profile_consent_events event
        WHERE event.doctor_id=staff.catalog_doctor_id
          AND event.clinic_location_id=staff.clinic_location_id
        ORDER BY event.occurred_at DESC,event.id DESC LIMIT 1
      ) public_consent ON public_consent.event_type='CONSENT_GRANTED'
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
