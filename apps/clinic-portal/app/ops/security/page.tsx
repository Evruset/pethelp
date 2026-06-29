import { redirect } from 'next/navigation';
import { getOpsAuditEvents, getOpsSloSnapshot } from '@/lib/api/ops-slo';
import { canAccessOps, getClinicSession } from '@/lib/auth/clinic-session';

export const dynamic = 'force-dynamic';

const numberFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
const integerFormatter = new Intl.NumberFormat('ru-RU');

type MetricRow = {
  label: string;
  value: string;
  tone: 'ok' | 'warn' | 'risk';
};

function seconds(value: number): string {
  return `${numberFormatter.format(value)} с`;
}

function toneClass(tone: MetricRow['tone']): string {
  if (tone === 'risk') return 'border-red-200 bg-red-50 text-red-800';
  if (tone === 'warn') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-emerald-200 bg-emerald-50 text-emerald-800';
}

function metricRows(snapshot: Awaited<ReturnType<typeof getOpsSloSnapshot>>): MetricRow[] {
  return [
    {
      label: 'API p95',
      value: `${numberFormatter.format(snapshot.technical.apiLatencyP95Ms)} мс`,
      tone: snapshot.technical.apiLatencyP95Ms > 1000 ? 'risk' : snapshot.technical.apiLatencyP95Ms > 500 ? 'warn' : 'ok',
    },
    {
      label: 'API error rate',
      value: `${numberFormatter.format(snapshot.technical.apiErrorRate * 100)}%`,
      tone: snapshot.technical.apiErrorRate > 0.05 ? 'risk' : snapshot.technical.apiErrorRate > 0.01 ? 'warn' : 'ok',
    },
    {
      label: 'Outbox lag',
      value: seconds(snapshot.technical.outboxLagSeconds),
      tone: snapshot.technical.outboxLagSeconds > 60 ? 'risk' : snapshot.technical.outboxLagSeconds > 15 ? 'warn' : 'ok',
    },
    {
      label: 'Outbox pending',
      value: integerFormatter.format(snapshot.technical.outboxPendingCount),
      tone: snapshot.technical.outboxPendingCount > 100 ? 'risk' : snapshot.technical.outboxPendingCount > 20 ? 'warn' : 'ok',
    },
    {
      label: 'MIS lag',
      value: seconds(snapshot.technical.misSyncLagSeconds),
      tone: snapshot.technical.misSyncLagSeconds > 60 ? 'risk' : snapshot.technical.misSyncLagSeconds > 15 ? 'warn' : 'ok',
    },
    {
      label: 'Payment reconciliation',
      value: integerFormatter.format(snapshot.technical.paymentReconciliationCount),
      tone: snapshot.technical.paymentReconciliationCount > 20 ? 'risk' : snapshot.technical.paymentReconciliationCount > 5 ? 'warn' : 'ok',
    },
    {
      label: 'Telemed queue wait',
      value: seconds(snapshot.technical.telemedQueueWaitSeconds),
      tone: snapshot.technical.telemedQueueWaitSeconds > 900 ? 'risk' : snapshot.technical.telemedQueueWaitSeconds > 300 ? 'warn' : 'ok',
    },
    {
      label: 'Permission denied',
      value: integerFormatter.format(snapshot.security.permissionDeniedLastHour),
      tone: snapshot.security.permissionDeniedLastHour > 50 ? 'risk' : snapshot.security.permissionDeniedLastHour > 10 ? 'warn' : 'ok',
    },
  ];
}

export default async function OpsSecurityPage() {
  const session = await getClinicSession();
  if (!session || !canAccessOps(session)) redirect('/forbidden');

  const [snapshot, auditEvents] = await Promise.all([
    getOpsSloSnapshot(session),
    getOpsAuditEvents(session, 25),
  ]);
  const rows = metricRows(snapshot);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950 sm:px-8 lg:px-12">
      <section className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-700">VetHelp · Security</p>
            <h1 className="mt-1 text-2xl font-semibold">Operational readiness</h1>
          </div>
          <time className="text-sm text-slate-600">{new Date(snapshot.serverNow).toLocaleString('ru-RU')}</time>
        </header>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <div key={row.label} className={`rounded-lg border px-4 py-3 ${toneClass(row.tone)}`}>
              <p className="text-xs font-semibold uppercase">{row.label}</p>
              <p className="mt-2 text-2xl font-semibold">{row.value}</p>
            </div>
          ))}
        </section>

        <section className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <tbody className="divide-y divide-slate-100">
              <OpsRow label="Outbox retry count" value={integerFormatter.format(snapshot.technical.outboxRetryCount)} />
              <OpsRow label="API samples, 5m" value={integerFormatter.format(snapshot.technical.apiSamples)} />
              <OpsRow label="Connection pool in use" value={integerFormatter.format(snapshot.technical.connectionPoolInUse)} />
              <OpsRow label="Connection pool waiting" value={integerFormatter.format(snapshot.technical.connectionPoolWaiting)} />
              <OpsRow label="MIS pending events" value={integerFormatter.format(snapshot.technical.misPendingCount)} />
              <OpsRow label="Clinic SLA breaches, 24h" value={integerFormatter.format(snapshot.business.clinicResponseSlaBreachesLast24h)} />
            </tbody>
          </table>
        </section>

        <section className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <header className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-base font-semibold">Latest audit events</h2>
          </header>
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Aggregate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditEvents.items.map((event) => (
                <tr key={event.id}>
                  <td className="px-4 py-3 text-slate-600">{new Date(event.occurredAt).toLocaleString('ru-RU')}</td>
                  <td className="px-4 py-3 font-medium">{event.action}</td>
                  <td className="px-4 py-3 text-slate-700">{event.actorType}{event.actorId ? ` · ${event.actorId}` : ''}</td>
                  <td className="break-all px-4 py-3 text-slate-600">{event.aggregateType} · {event.aggregateId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </section>
    </main>
  );
}

function OpsRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <th scope="row" className="w-2/3 px-4 py-3 font-medium text-slate-700">{label}</th>
      <td className="px-4 py-3 font-semibold text-slate-950">{value}</td>
    </tr>
  );
}
