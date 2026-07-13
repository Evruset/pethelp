import { ClinicScheduleClient } from '@/components/schedule/ClinicScheduleClient';
import { ClinicScheduleBackendError, getClinicSchedule } from '@/lib/api/clinic-schedule';
import { canAccessClinicLocation, getClinicSession } from '@/lib/auth/clinic-session';
import { getEffectiveSession, hasCapability, hasClinicScope } from '@/lib/auth/effective-session';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{
    clinicId: string;
    locationId: string;
  }>;
};

function AccessDenied() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-12">
      <section className="w-full rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold text-red-700">403 Access Denied</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Нет доступа к расписанию</h1>
        <p className="mt-3 text-base leading-7 text-slate-600">Доступ к расписанию проверяется по clinic/location claims и active membership.</p>
      </section>
    </main>
  );
}

function ServiceUnavailable() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-12">
      <section className="w-full rounded-2xl border border-amber-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold text-amber-700">Расписание временно недоступно</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Не удалось получить слоты</h1>
        <p className="mt-3 text-base leading-7 text-slate-600">Проверьте подключение к VetHelp и обновите страницу.</p>
      </section>
    </main>
  );
}

export default async function ClinicSchedulePage({ params }: PageProps) {
  const { clinicId, locationId } = await params;
  const session = await getClinicSession();

  if (!session || !canAccessClinicLocation(session, clinicId, locationId)) {
    return <AccessDenied />;
  }

  try {
    const effectiveSession = await getEffectiveSession(session);
    if (!hasCapability(effectiveSession, 'schedule.read') || !hasClinicScope(effectiveSession, clinicId, locationId)) return <AccessDenied />;
  } catch {
    return <ServiceUnavailable />;
  }

  const from = new Date().toISOString();
  const to = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const schedule = await getClinicSchedule(session, clinicId, locationId, from, to);
    // Clinical completion is intentionally unavailable from the administrative
    // schedule. Veterinarians complete visits in the dedicated capability-gated
    // /vet/visits workspace.
    return <ClinicScheduleClient clinicId={clinicId} locationId={locationId} initialSchedule={schedule} canCompleteAppointments={false} />;
  } catch (error) {
    if (error instanceof ClinicScheduleBackendError && error.status === 403) {
      return <AccessDenied />;
    }
    return <ServiceUnavailable />;
  }
}
