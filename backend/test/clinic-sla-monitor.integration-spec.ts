import { randomUUID } from 'node:crypto';
import { ClinicSlaMonitorWorker } from '../src/booking-core/clinic-sla-monitor.worker';
import { DatabaseService } from '../src/database/database.service';
import { ContextLoggerService } from '../src/observability/context-logger.service';
import { ObservabilityMetricsService } from '../src/observability/observability.metrics';
import { TraceContext } from '../src/observability/trace-context.context';

jest.setTimeout(30_000);

describe('ClinicSlaMonitorWorker', () => {
  const database = new DatabaseService();
  const trace = new TraceContext();
  const logger = new ContextLoggerService(trace);
  const metrics = new ObservabilityMetricsService(logger);
  const worker = new ClinicSlaMonitorWorker(database, trace, logger, metrics);

  afterAll(async () => {
    await database.onModuleDestroy();
  });

  it('marks an overdue Level-C manual hold as SLA_BREACHED and releases its slot', async () => {
    const fixture = await createSlaFixture(database);
    const alertSpy = jest.spyOn(metrics, 'critical').mockImplementation();

    await worker.monitorManualConfirmationSla();

    const result = await database.query<{ state: string; held_count: number; status: string; breached_events: string }>(`
      SELECT
        (SELECT state FROM booking_schema.booking_holds WHERE id = $1::uuid) AS state,
        (SELECT held_count FROM clinic_schema.appointment_slots WHERE id = $2::uuid) AS held_count,
        (SELECT status FROM clinic_schema.appointment_slots WHERE id = $2::uuid) AS status,
        (SELECT COUNT(*)::text FROM booking_schema.outbox_events WHERE event_type = 'clinic.sla.breached.v1' AND aggregate_id = $1::uuid) AS breached_events
    `, [fixture.holdId, fixture.slotId]);

    expect(result.rows[0]).toMatchObject({
      state: 'SLA_BREACHED',
      held_count: 0,
      status: 'AVAILABLE',
      breached_events: '1',
    });
    expect(alertSpy).toHaveBeenCalledWith(
      'CLINIC_SLA_BREACHED',
      ClinicSlaMonitorWorker.name,
      expect.any(String),
      expect.objectContaining({ holdId: fixture.holdId, slotId: fixture.slotId }),
    );

    alertSpy.mockRestore();
  });
});

async function createSlaFixture(database: DatabaseService): Promise<{ holdId: string; slotId: string }> {
  const ownerId = randomUUID();
  const petId = randomUUID();

  await database.query('TRUNCATE clinic_schema.clinics CASCADE');
  await database.query('TRUNCATE pet_schema.pets, identity_schema.users CASCADE');
  await database.query('TRUNCATE booking_schema.outbox_events, booking_schema.idempotency_records, audit_schema.audit_log');

  await database.query('INSERT INTO identity_schema.users (id) VALUES ($1::uuid)', [ownerId]);
  await database.query(`INSERT INTO pet_schema.pets (id, owner_id, name, species) VALUES ($1::uuid, $2::uuid, 'SLA pet', 'DOG')`, [petId, ownerId]);
  const clinic = await database.query<{ id: string }>(`INSERT INTO clinic_schema.clinics (legal_name, public_name) VALUES ('SLA LLC', 'SLA clinic') RETURNING id`);
  const location = await database.query<{ id: string }>(`INSERT INTO clinic_schema.clinic_locations (clinic_id, address) VALUES ($1::uuid, 'SLA test location') RETURNING id`, [clinic.rows[0].id]);
  const service = await database.query<{ id: string }>(`INSERT INTO clinic_schema.clinic_services (clinic_location_id, code, display_name, duration_minutes) VALUES ($1::uuid, 'SLA_VISIT', 'SLA visit', 30) RETURNING id`, [location.rows[0].id]);
  const slot = await database.query<{ id: string }>(`
    INSERT INTO clinic_schema.appointment_slots (
      clinic_location_id, service_id, starts_at, ends_at, capacity, held_count, status, integration_mode
    ) VALUES (
      $1::uuid, $2::uuid, clock_timestamp() + interval '2 hours', clock_timestamp() + interval '150 minutes',
      1, 1, 'LOCKED_BY_HOLD', 'LEVEL_C'
    ) RETURNING id
  `, [location.rows[0].id, service.rows[0].id]);
  const hold = await database.query<{ id: string }>(`
    INSERT INTO booking_schema.booking_holds (
      slot_id, owner_id, pet_id, state, expires_at, confirmation_sla_expires_at
    ) VALUES (
      $1::uuid, $2::uuid, $3::uuid, 'MANUAL_CONFIRM_PENDING',
      clock_timestamp() + interval '1 minute', clock_timestamp() - interval '1 second'
    ) RETURNING id
  `, [slot.rows[0].id, ownerId, petId]);

  return { holdId: hold.rows[0].id, slotId: slot.rows[0].id };
}
