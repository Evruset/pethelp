import 'reflect-metadata';
import { writeFile } from 'node:fs/promises';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { PoolClient } from 'pg';
import request from 'supertest';
import { Role } from '../src/auth/auth.types';
import { ClinicWorkspaceHomeService } from '../src/booking-core/clinic-workspace-home.service';
import { DatabaseService } from '../src/database/database.service';
import { NestRoot } from '../src/nest-root-full';
import { config } from '../src/config';
import { resetWorkspaceFixtures, WORKSPACE_IDS as IDS } from './clinic-workspace-home.fixtures';

jest.setTimeout(240_000);
const rows = Number(process.env.WORKSPACE_HOME_PERF_ROWS ?? 10_000);
const evidencePath = process.env.WORKSPACE_HOME_PERF_EVIDENCE_PATH ?? '/tmp/clinic-workspace-home-10k.json';

describe('Clinic Workspace Home deterministic performance', () => {
  let database: DatabaseService;
  let workspace: ClinicWorkspaceHomeService;
  let app: Awaited<ReturnType<typeof NestFactory.create>>;

  beforeAll(async () => {
    process.env.WORKERS_ENABLED = 'false';
    app = await NestFactory.create(NestRoot, { logger: false });
    await app.init();
    database = app.get(DatabaseService);
    workspace = app.get(ClinicWorkspaceHomeService);
    await seed(database, rows);
  });
  afterAll(async () => {
    if (database) await cleanupFixtures(database);
    await app?.close();
  });

  it('meets latency, payload, cardinality, plan and cleanup gates', async () => {
    const employee = { sub: IDS.receptionist, roles: [Role.CLINIC_RECEPTIONIST], clinicIds: [IDS.clinic], locationIds: [IDS.location] };
    const token = await app.get(JwtService).signAsync(employee, { secret: config.jwtSecret, issuer: config.jwtIssuer, audience: config.jwtAudience, algorithm: 'HS256' });
    const httpAgent = request.agent(app.getHttpServer());
    const durations: number[] = [];
    let responseBytes = 0;
    let crossScopeLeakCount = 0;
    let authorityQueries = 0;
    let operationalQueries = 0;
    const originalWithTransaction = database.withTransaction.bind(database);
    database.withTransaction = ((work: (client: PoolClient) => Promise<unknown>, options?: Parameters<DatabaseService['withTransaction']>[1]) => originalWithTransaction(async (client) => {
      const counted = new Proxy(client, { get(target, property, receiver) {
        if (property !== 'query') return Reflect.get(target, property, receiver);
        return (text: unknown, ...parameters: unknown[]) => {
          if (typeof text === 'string' && text.includes('employee_location_memberships membership')) authorityQueries += 1;
          if (typeof text === 'string' && (text.includes('booking_schema.booking_holds') || text.includes('booking_schema.appointments'))) operationalQueries += 1;
          return (target.query as (...args: unknown[]) => unknown)(text, ...parameters);
        };
      } }) as PoolClient;
      return work(counted);
    }, options)) as DatabaseService['withTransaction'];
    const warmupExecutions = 15;
    const measuredExecutions = 30;
    for (let iteration = 0; iteration < warmupExecutions + measuredExecutions; iteration += 1) {
      const started = performance.now();
      const http = await httpAgent.get(`/v1/clinic/${IDS.clinic}/locations/${IDS.location}/workspace-home`).set('Authorization', `Bearer ${token}`).expect(200);
      const duration = performance.now() - started;
      if (iteration >= warmupExecutions) durations.push(duration);
      responseBytes = Buffer.byteLength(http.text);
      expect(http.body.sections[0]).toMatchObject({ availability: 'AVAILABLE', facts: { waitingCount: 999, slaRisk: 'DUE_SOON' } });
      expect(http.body.sections[2]).toMatchObject({ availability: 'AVAILABLE', facts: { todayCount: 999, requiresActionCount: 0 } });
      if (http.body.sections[0].facts.slaRisk !== 'DUE_SOON' || http.body.sections[2].facts.requiresActionCount !== 0) crossScopeLeakCount += 1;
    }
    const queuePlans = await explainThree(database, QUEUE_SQL, [IDS.location, new Date()]);
    const appointmentPlans = await explainThree(database, APPOINTMENTS_SQL, [IDS.location, new Date(), 'Europe/Moscow', ['COMPLETED','NO_SHOW','CLINIC_CANCELLED','CANCELLED']]);
    const plans = [...queuePlans, ...appointmentPlans];
    const nodes = plans.flatMap(planNodes);
    const p50 = percentile(durations, 0.50);
    const p95 = percentile(durations, 0.95);
    const p99 = percentile(durations, 0.99);
    const seqScanCount = nodes.filter((node) => node['Node Type'] === 'Seq Scan' && ['booking_holds','appointments','appointment_slots'].includes(String(node['Relation Name']))).length;
    const tempReadBlocks = sum(nodes, 'Temp Read Blocks');
    const tempWrittenBlocks = sum(nodes, 'Temp Written Blocks');
    const spillCount = nodes.filter((node) => String(node['Sort Method'] ?? '').includes('external') || node['Sort Space Type'] === 'Disk' || Number(node['Hash Batches'] ?? 1) > 1 || Number(node['HashAgg Batches'] ?? 1) > 1 || Number(node['Disk Usage'] ?? 0) > 0 || Number(node['Temp Read Blocks'] ?? 0) > 0 || Number(node['Temp Written Blocks'] ?? 0) > 0).length;
    await cleanupFixtures(database);
    const cleanupResult = await database.query<{ holds: string; appointments: string; slots: string; memberships: string }>(`SELECT (SELECT count(*) FROM booking_schema.booking_holds)::text holds,(SELECT count(*) FROM booking_schema.appointments)::text appointments,(SELECT count(*) FROM clinic_schema.appointment_slots)::text slots,(SELECT count(*) FROM clinic_schema.employee_location_memberships)::text memberships`);
    const cleanup = cleanupResult.rows[0];
    const measuredRequests = warmupExecutions + measuredExecutions;
    const authorityQueryCount = authorityQueries / measuredRequests;
    const operationalQueryCount = operationalQueries / measuredRequests;
    const evidence = { rows, iterations: durations.length, p50, p95, p99, responseBytes, authorityQueryCount, operationalQueryCount, queuePlans, appointmentPlans, seqScanCount, spillCount, tempReadBlocks, tempWrittenBlocks, crossScopeLeakCount, cleanup };
    await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
    expect(p95).toBeLessThan(150);
    expect(p99).toBeLessThan(300);
    expect(responseBytes).toBeLessThanOrEqual(8192);
    expect({ authorityQueryCount, operationalQueryCount }).toEqual({ authorityQueryCount: 1, operationalQueryCount: 2 });
    expect(queuePlans.every((plan) => plan.Plan['Actual Rows'] === 1)).toBe(true);
    expect(appointmentPlans.every((plan) => plan.Plan['Actual Rows'] === 1)).toBe(true);
    expect({ seqScanCount, spillCount, tempReadBlocks, tempWrittenBlocks, crossScopeLeakCount }).toEqual({ seqScanCount: 0, spillCount: 0, tempReadBlocks: 0, tempWrittenBlocks: 0, crossScopeLeakCount: 0 });
    expect(cleanup).toEqual({ holds: '0', appointments: '0', slots: '0', memberships: '0' });
  });
});

async function seed(database: DatabaseService, count: number): Promise<void> {
  await resetWorkspaceFixtures(database);
  const totalSlots = count * 10;
  const totalOperationalRows = count + 100;
  await database.query(`INSERT INTO clinic_schema.appointment_slots (id,clinic_location_id,starts_at,ends_at,capacity,held_count,booked_count,state,status,integration_mode) SELECT md5('wq'||g)::uuid,CASE WHEN g<=$2::int THEN $1::uuid ELSE $3::uuid END,clock_timestamp()+interval '2 hours',clock_timestamp()+interval '3 hours',1,CASE WHEN g<=$2::int+100 THEN 1 ELSE 0 END,0,'OPEN',CASE WHEN g<=$2::int+100 THEN 'LOCKED_BY_HOLD' ELSE 'AVAILABLE' END,'LEVEL_C' FROM generate_series(1,$4::int) g`, [IDS.location, count, IDS.otherClinicLocation, totalSlots]);
  await database.query(`INSERT INTO booking_schema.booking_holds (id,slot_id,owner_id,pet_id,state,expires_at,state_changed_at,confirmation_sla_expires_at) SELECT md5('wh'||g)::uuid,md5('wq'||g)::uuid,$2,$3,'MANUAL_CONFIRM_PENDING',clock_timestamp()+interval '1 day',clock_timestamp()-interval '8 minutes',CASE WHEN g<=$4::int THEN clock_timestamp()+interval '2 minutes' ELSE clock_timestamp()-interval '2 minutes' END FROM generate_series(1,$1::int) g`, [totalOperationalRows, IDS.owner, IDS.pet, count]);
  await database.query(`INSERT INTO clinic_schema.appointment_slots (id,clinic_location_id,starts_at,ends_at,capacity,held_count,booked_count,state,status,integration_mode) SELECT md5('as'||g)::uuid,CASE WHEN g<=$2::int THEN $1::uuid ELSE $3::uuid END,CASE WHEN g<=$2::int THEN ((clock_timestamp() AT TIME ZONE 'Europe/Moscow')::date AT TIME ZONE 'Europe/Moscow')+interval '12 hours'+(g%3600)*interval '1 second' ELSE clock_timestamp()-interval '2 hours' END,CASE WHEN g<=$2::int THEN ((clock_timestamp() AT TIME ZONE 'Europe/Moscow')::date AT TIME ZONE 'Europe/Moscow')+interval '13 hours'+(g%3600)*interval '1 second' ELSE clock_timestamp()-interval '1 hour' END,1,0,CASE WHEN g<=$2::int+100 THEN 1 ELSE 0 END,'OPEN',CASE WHEN g<=$2::int+100 THEN 'BOOKED' ELSE 'AVAILABLE' END,'LEVEL_C' FROM generate_series(1,$4::int) g`, [IDS.location, count, IDS.otherClinicLocation, totalSlots]);
  await database.query(`INSERT INTO booking_schema.booking_holds (id,slot_id,owner_id,pet_id,state,expires_at,state_changed_at) SELECT md5('ah'||g)::uuid,md5('as'||g)::uuid,$2,$3,'CONFIRMED',clock_timestamp()+interval '1 day',clock_timestamp() FROM generate_series(1,$1::int) g`, [totalOperationalRows, IDS.owner, IDS.pet]);
  await database.query(`INSERT INTO booking_schema.appointments (id,hold_id,owner_id,pet_id,clinic_location_id,slot_id,status) SELECT md5('aa'||g)::uuid,md5('ah'||g)::uuid,$2,$3,CASE WHEN g<=$5::int THEN $4::uuid ELSE $6::uuid END,md5('as'||g)::uuid,CASE WHEN g<=$5::int THEN 'COMPLETED' ELSE 'CONFIRMED' END FROM generate_series(1,$1::int) g`, [totalOperationalRows, IDS.owner, IDS.pet, IDS.location, count, IDS.otherClinicLocation]);
  await database.query('VACUUM (ANALYZE) booking_schema.booking_holds');
  await database.query('VACUUM (ANALYZE) booking_schema.appointments');
  await database.query('VACUUM (ANALYZE) clinic_schema.appointment_slots');
}

async function cleanupFixtures(database: DatabaseService): Promise<void> {
  await database.query('TRUNCATE clinic_schema.clinics, pet_schema.pets, identity_schema.users CASCADE');
  await database.query('TRUNCATE booking_schema.outbox_events, booking_schema.idempotency_records, audit_schema.audit_log');
}

async function explainThree(database: DatabaseService, sql: string, parameters: unknown[]): Promise<any[]> {
  const client = await database.pool.connect();
  try { const plans = []; for (let i=0;i<3;i+=1) { const result = await client.query(`EXPLAIN (ANALYZE, BUFFERS, WAL, SETTINGS, VERBOSE, FORMAT JSON) ${sql}`, parameters); plans.push(result.rows[0]['QUERY PLAN'][0]); } return plans; }
  finally { client.release(); }
}
function planNodes(plan: any): any[] { const output: any[]=[]; const visit=(node:any)=>{ output.push(node); for(const child of node.Plans ?? []) visit(child); }; visit(plan.Plan); return output; }
function sum(nodes: any[], key: string): number { return nodes.reduce((total,node)=>total+Number(node[key] ?? 0),0); }
function percentile(values: number[], rank: number): number { const sorted=[...values].sort((a,b)=>a-b); return Number(sorted[Math.ceil(sorted.length*rank)-1].toFixed(3)); }

const QUEUE_SQL = `SELECT COUNT(*)::text AS waiting_count,COUNT(*) FILTER (WHERE hold.confirmation_sla_expires_at <= $2::timestamptz + interval '5 minutes')::text AS requires_action_count,EXTRACT(EPOCH FROM ($2::timestamptz - MIN(hold.state_changed_at)))::text AS oldest_age_seconds,COALESCE(bool_or(hold.confirmation_sla_expires_at <= $2::timestamptz),false) has_overdue,COALESCE(bool_or(hold.confirmation_sla_expires_at > $2::timestamptz AND hold.confirmation_sla_expires_at <= $2::timestamptz+interval '5 minutes'),false) has_due_soon,COALESCE(bool_or(hold.state_changed_at > $2::timestamptz OR hold.confirmation_sla_expires_at < hold.state_changed_at),false) has_inconsistent FROM (SELECT scoped_hold.slot_id,scoped_hold.state_changed_at,scoped_hold.confirmation_sla_expires_at FROM booking_schema.booking_holds scoped_hold WHERE scoped_hold.state='MANUAL_CONFIRM_PENDING' AND scoped_hold.confirmation_sla_expires_at IS NOT NULL ORDER BY scoped_hold.state_changed_at,scoped_hold.id OFFSET 0) hold JOIN clinic_schema.appointment_slots slot ON slot.id=hold.slot_id AND slot.clinic_location_id=$1::uuid`;
const APPOINTMENTS_SQL = `WITH bounds AS (SELECT (($2::timestamptz AT TIME ZONE $3)::date AT TIME ZONE $3) day_start,((($2::timestamptz AT TIME ZONE $3)::date+1) AT TIME ZONE $3) day_end) SELECT COUNT(*) FILTER(WHERE slot.starts_at>=bounds.day_start AND slot.starts_at<bounds.day_end AND appointment.status NOT IN ('CLINIC_CANCELLED','CANCELLED'))::text today_count,COUNT(*) FILTER(WHERE appointment.status<>ALL($4::text[]) AND slot.ends_at<=$2::timestamptz)::text requires_action_count,MIN(slot.starts_at) FILTER(WHERE appointment.status<>ALL($4::text[]) AND slot.starts_at>$2::timestamptz) next_scheduled_at FROM (SELECT scoped_slot.id,scoped_slot.starts_at,scoped_slot.ends_at FROM clinic_schema.appointment_slots scoped_slot WHERE scoped_slot.clinic_location_id=$1::uuid ORDER BY scoped_slot.starts_at,scoped_slot.id OFFSET 0) slot JOIN LATERAL (SELECT scoped.status FROM booking_schema.appointments scoped WHERE scoped.slot_id=slot.id AND scoped.clinic_location_id=$1::uuid OFFSET 0) appointment ON true CROSS JOIN bounds`;
