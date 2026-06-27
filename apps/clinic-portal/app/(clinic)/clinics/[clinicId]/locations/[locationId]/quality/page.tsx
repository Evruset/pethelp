import { ClinicQualityBackendError, getClinicQualityDashboard, type ClinicQualityDashboard, type QualityMetric } from '@/lib/api/clinic-quality';
import { canAccessClinicLocation, getClinicSession } from '@/lib/auth/clinic-session';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{
    clinicId: string;
    locationId: string;
  }>;
};

function percent(metric: QualityMetric): string {
  return metric.value == null ? 'нет данных' : `${Math.round(metric.value * 1000) / 10}%`;
}

function ratio(metric: QualityMetric): string {
  return `${metric.numerator}/${metric.denominator}`;
}

function minutes(value: number | null): string {
  return value == null ? 'нет данных' : `${Math.round(value * 10) / 10} мин`;
}

function AccessDenied() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-12">
      <section className="w-full rounded-lg border border-red-200 bg-white p-8">
        <p className="text-sm font-semibold text-red-700">403 Access Denied</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Нет доступа к quality dashboard</h1>
        <p className="mt-3 text-base leading-7 text-slate-600">Доступ проверяется по clinic/location claims.</p>
      </section>
    </main>
  );
}

function ServiceUnavailable() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-12">
      <section className="w-full rounded-lg border border-amber-200 bg-white p-8">
        <p className="text-sm font-semibold text-amber-700">Quality dashboard временно недоступен</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Не удалось получить метрики</h1>
        <p className="mt-3 text-base leading-7 text-slate-600">Проверьте подключение к VetHelp и обновите страницу.</p>
      </section>
    </main>
  );
}

function MetricRow({ label, value, sample }: { label: string; value: string; sample: string }) {
  return (
    <tr className="border-t border-slate-200">
      <td className="px-4 py-3 text-sm font-semibold text-slate-900">{label}</td>
      <td className="px-4 py-3 text-sm text-slate-700">{value}</td>
      <td className="px-4 py-3 text-sm text-slate-500">{sample}</td>
    </tr>
  );
}

function Dashboard({ dashboard }: { dashboard: ClinicQualityDashboard }) {
  const metricRows = [
    ['First response SLA', percent(dashboard.metrics.firstResponseSla), ratio(dashboard.metrics.firstResponseSla)],
    ['Confirm rate', percent(dashboard.metrics.confirmRate), ratio(dashboard.metrics.confirmRate)],
    ['Alternative rate', percent(dashboard.metrics.alternativeRate), ratio(dashboard.metrics.alternativeRate)],
    ['Cancellation rate', percent(dashboard.metrics.cancellationRate), ratio(dashboard.metrics.cancellationRate)],
    ['No-show rate', percent(dashboard.metrics.noShowRate), ratio(dashboard.metrics.noShowRate)],
    ['Booking conversion', percent(dashboard.metrics.bookingConversion), ratio(dashboard.metrics.bookingConversion)],
    ['Telemed referral conversion', percent(dashboard.metrics.telemedReferralConversion), ratio(dashboard.metrics.telemedReferralConversion)],
    ['Owner return rate', percent(dashboard.metrics.ownerReturnRate), ratio(dashboard.metrics.ownerReturnRate)],
  ] as const;

  return (
    <main className="min-h-screen px-4 py-6 sm:px-8 lg:px-12">
      <section className="mx-auto max-w-6xl">
        <header className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-blue-700">VetHelp · Quality</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Service Quality Dashboard</h1>
          <p className="mt-2 text-sm text-slate-600">
            Период: {new Date(dashboard.from).toLocaleDateString('ru-RU')} - {new Date(dashboard.to).toLocaleDateString('ru-RU')}. Сгенерировано: {new Date(dashboard.generatedAt).toLocaleString('ru-RU')}.
          </p>
        </header>

        <section className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-500">Среднее подтверждение</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{minutes(dashboard.metrics.averageConfirmationMinutes)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-500">Stale availability incidents</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{dashboard.metrics.staleAvailabilityIncidents}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-500">Quality loop</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">Скорость ответа и актуальность availability влияют на релевантность клиники в выдаче.</p>
          </div>
        </section>

        <section className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full table-fixed border-collapse text-left">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-1/2 px-4 py-3">Метрика</th>
                <th className="w-1/4 px-4 py-3">Значение</th>
                <th className="w-1/4 px-4 py-3">Выборка</th>
              </tr>
            </thead>
            <tbody>
              {metricRows.map(([label, value, sample]) => <MetricRow key={label} label={label} value={value} sample={sample} />)}
            </tbody>
          </table>
        </section>
      </section>
    </main>
  );
}

export default async function ClinicQualityPage({ params }: PageProps) {
  const { clinicId, locationId } = await params;
  const session = await getClinicSession();
  if (!session || !canAccessClinicLocation(session, clinicId, locationId)) return <AccessDenied />;

  const to = new Date().toISOString();
  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  try {
    const dashboard = await getClinicQualityDashboard(session, clinicId, locationId, from, to);
    return <Dashboard dashboard={dashboard} />;
  } catch (error) {
    if (error instanceof ClinicQualityBackendError && error.status === 403) return <AccessDenied />;
    return <ServiceUnavailable />;
  }
}
