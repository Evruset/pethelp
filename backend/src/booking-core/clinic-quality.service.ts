import { Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/auth.types';
import { DomainErrors } from '../common/domain-error';
import { DatabaseService } from '../database/database.service';
import { ClinicEmployeeAccessService } from './clinic-employee-access.service';

type MetricValue = {
  value: number | null;
  numerator: number;
  denominator: number;
};

type QualityRow = {
  total_requests: string;
  appointments: string;
  confirmed_holds: string;
  cancelled_holds: string;
  alternative_holds: string;
  holds_with_sla: string;
  first_response_within_sla: string;
  average_confirmation_minutes: string | null;
  no_show_appointments: string;
  stale_slots: string;
  total_slots: string;
  telemed_sessions: string;
  telemed_converted: string;
  returning_owners: string;
  distinct_owners: string;
};

export type ClinicQualityDashboard = {
  clinicId: string;
  locationId: string;
  from: string;
  to: string;
  generatedAt: string;
  metrics: {
    firstResponseSla: MetricValue;
    confirmRate: MetricValue;
    alternativeRate: MetricValue;
    cancellationRate: MetricValue;
    noShowRate: MetricValue;
    averageConfirmationMinutes: number | null;
    staleAvailabilityIncidents: number;
    bookingConversion: MetricValue;
    telemedReferralConversion: MetricValue;
    ownerReturnRate: MetricValue;
  };
};

@Injectable()
export class ClinicQualityService {
  constructor(
    private readonly database: DatabaseService,
    private readonly clinicAccess: ClinicEmployeeAccessService,
  ) {}

  async dashboard(input: { clinicId: string; locationId: string; employee: JwtPayload; from: string; to: string }): Promise<ClinicQualityDashboard> {
    return this.database.withTransaction(async (client) => {
      await client.query("SET LOCAL statement_timeout = '350ms'");
      await this.clinicAccess.assertQualityReadAccess(client, input.employee, input.clinicId, input.locationId);
      const location = await client.query<{ id: string }>(`
        SELECT id
        FROM clinic_schema.clinic_locations
        WHERE id = $1::uuid
          AND clinic_id = $2::uuid
          AND status = 'ACTIVE'
        FOR SHARE
      `, [input.locationId, input.clinicId]);
      if (!location.rows[0]) throw DomainErrors.clinicScopeMismatch();

      const result = await client.query<QualityRow>(`
        WITH scoped_holds AS (
          SELECT h.id, h.owner_id, h.state, h.created_at, h.state_changed_at, h.confirmation_sla_expires_at
          FROM booking_schema.booking_holds h
          JOIN clinic_schema.appointment_slots slot ON slot.id = h.slot_id
          WHERE slot.clinic_location_id = $1::uuid
            AND h.created_at >= $2::timestamptz
            AND h.created_at < $3::timestamptz
        ),
        first_responses AS (
          SELECT h.id AS hold_id, MIN(audit.occurred_at) AS first_response_at
          FROM scoped_holds h
          LEFT JOIN audit_schema.audit_log audit
            ON audit.aggregate_type = 'booking_hold'
           AND audit.aggregate_id = h.id
           AND audit.action IN (
             'booking.confirmed',
             'booking.declined',
             'booking.notes.requested',
             'booking.hold.released',
             'BOOKING_ALTERNATIVE_PROPOSED'
           )
          GROUP BY h.id
        ),
        appointments AS (
          SELECT appointment.id, appointment.owner_id, appointment.status, appointment.created_at, hold.created_at AS hold_created_at
          FROM booking_schema.appointments appointment
          JOIN booking_schema.booking_holds hold ON hold.id = appointment.hold_id
          WHERE appointment.clinic_location_id = $1::uuid
            AND appointment.created_at >= $2::timestamptz
            AND appointment.created_at < $3::timestamptz
        ),
        owners AS (
          SELECT owner_id, COUNT(*) AS appointment_count
          FROM appointments
          GROUP BY owner_id
        ),
        slots AS (
          SELECT id, last_freshness_sync
          FROM clinic_schema.appointment_slots
          WHERE clinic_location_id = $1::uuid
            AND starts_at >= $2::timestamptz
            AND starts_at < $3::timestamptz
        ),
        telemed AS (
          SELECT session.id, session.state
          FROM telemed_schema.telemed_sessions session
          JOIN booking_schema.booking_holds hold ON hold.id = session.booking_hold_id
          JOIN clinic_schema.appointment_slots slot ON slot.id = hold.slot_id
          WHERE slot.clinic_location_id = $1::uuid
            AND session.created_at >= $2::timestamptz
            AND session.created_at < $3::timestamptz
        )
        SELECT
          (SELECT COUNT(*) FROM scoped_holds)::text AS total_requests,
          (SELECT COUNT(*) FROM appointments)::text AS appointments,
          (SELECT COUNT(*) FROM scoped_holds WHERE state IN ('CONFIRMED','MIS_HELD','PAYMENT_PENDING','PAYMENT_IN_PROGRESS','PAYMENT_RECONCILIATION_PENDING'))::text AS confirmed_holds,
          (SELECT COUNT(*) FROM scoped_holds WHERE state = 'RELEASED')::text AS cancelled_holds,
          (SELECT COUNT(DISTINCT original_hold_id) FROM booking_schema.alternative_swap_groups swap JOIN scoped_holds h ON h.id = swap.original_hold_id)::text AS alternative_holds,
          (SELECT COUNT(*) FROM scoped_holds WHERE confirmation_sla_expires_at IS NOT NULL)::text AS holds_with_sla,
          (SELECT COUNT(*) FROM scoped_holds h JOIN first_responses response ON response.hold_id = h.id WHERE h.confirmation_sla_expires_at IS NOT NULL AND response.first_response_at <= h.confirmation_sla_expires_at)::text AS first_response_within_sla,
          (SELECT AVG(EXTRACT(EPOCH FROM (created_at - hold_created_at)) / 60)::text FROM appointments)::text AS average_confirmation_minutes,
          (SELECT COUNT(*) FROM appointments WHERE status = 'NO_SHOW')::text AS no_show_appointments,
          (SELECT COUNT(*) FROM slots WHERE last_freshness_sync IS NULL OR last_freshness_sync < clock_timestamp() - interval '15 minutes')::text AS stale_slots,
          (SELECT COUNT(*) FROM slots)::text AS total_slots,
          (SELECT COUNT(*) FROM telemed)::text AS telemed_sessions,
          (SELECT COUNT(*) FROM telemed WHERE state IN ('CONNECTED','COMPLETED'))::text AS telemed_converted,
          (SELECT COUNT(*) FROM owners WHERE appointment_count > 1)::text AS returning_owners,
          (SELECT COUNT(*) FROM owners)::text AS distinct_owners
      `, [input.locationId, input.from, input.to]);

      const row = result.rows[0];
      const totalRequests = Number(row.total_requests);
      const appointments = Number(row.appointments);
      const telemedSessions = Number(row.telemed_sessions);
      const distinctOwners = Number(row.distinct_owners);
      return {
        clinicId: input.clinicId,
        locationId: input.locationId,
        from: input.from,
        to: input.to,
        generatedAt: new Date().toISOString(),
        metrics: {
          firstResponseSla: this.metric(Number(row.first_response_within_sla), Number(row.holds_with_sla)),
          confirmRate: this.metric(Number(row.confirmed_holds), totalRequests),
          alternativeRate: this.metric(Number(row.alternative_holds), totalRequests),
          cancellationRate: this.metric(Number(row.cancelled_holds), totalRequests),
          noShowRate: this.metric(Number(row.no_show_appointments), appointments),
          averageConfirmationMinutes: row.average_confirmation_minutes === null ? null : Number(row.average_confirmation_minutes),
          staleAvailabilityIncidents: Number(row.stale_slots),
          bookingConversion: this.metric(appointments, totalRequests),
          telemedReferralConversion: this.metric(Number(row.telemed_converted), telemedSessions),
          ownerReturnRate: this.metric(Number(row.returning_owners), distinctOwners),
        },
      };
    });
  }

  private metric(numerator: number, denominator: number): MetricValue {
    return {
      value: denominator > 0 ? numerator / denominator : null,
      numerator,
      denominator,
    };
  }
}
