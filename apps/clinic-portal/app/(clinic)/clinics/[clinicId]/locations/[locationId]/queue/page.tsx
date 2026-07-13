import { ClinicQueueClientV2 } from '@/components/queue/ClinicQueueClientV2';
import { ClinicBackendError, getManualConfirmationQueue } from '@/lib/api/clinic-queue';
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
      <section className="w-full rounded-2xl border border-red-200 bg-white p-8 shadow-sm" aria-labelledby="access-denied-title">
        <p className="text-sm font-semibold text-red-700">403 Access Denied</p>
        <h1 id="access-denied-title" className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Нет доступа к этой локации
        </h1>
        <p className="mt-3 text-base leading-7 text-slate-600">
          Вернитесь к доступным локациям клиники.
        </p>
      </section>
    </main>
  );
}

function ServiceUnavailable() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-12">
      <section className="w-full rounded-2xl border border-amber-200 bg-white p-8 shadow-sm" aria-labelledby="queue-unavailable-title">
        <p className="text-sm font-semibold text-amber-700">Очередь временно недоступна</p>
        <h1 id="queue-unavailable-title" className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Не удалось получить актуальные заявки
        </h1>
        <p className="mt-3 text-base leading-7 text-slate-600">
          Проверьте подключение к VetHelp и обновите страницу. Данные заявок не отображаются, пока сервер не подтвердит доступ.
        </p>
      </section>
    </main>
  );
}

export default async function ClinicQueuePage({ params }: PageProps) {
  const { clinicId, locationId } = await params;
  const session = await getClinicSession();

  if (!session || !canAccessClinicLocation(session, clinicId, locationId)) {
    return <AccessDenied />;
  }

  try {
    const effectiveSession = await getEffectiveSession(session);
    if (!hasCapability(effectiveSession, 'booking.queue.read') || !hasClinicScope(effectiveSession, clinicId, locationId)) return <AccessDenied />;
    const canInspectHold = hasCapability(effectiveSession, 'booking.hold.read') && hasClinicScope(effectiveSession, clinicId, locationId);
    const canReplayHold = hasCapability(effectiveSession, 'booking.replay.read') && hasClinicScope(effectiveSession, clinicId, locationId);
    try {
      const queue = await getManualConfirmationQueue(session, clinicId, locationId);
      return <ClinicQueueClientV2 clinicId={clinicId} locationId={locationId} initialQueue={queue} canInspectHold={canInspectHold} canReplayHold={canReplayHold} />;
    } catch (error) {
      if (error instanceof ClinicBackendError && error.status === 403) return <AccessDenied />;
      return <ServiceUnavailable />;
    }
  } catch {
    return <ServiceUnavailable />;
  }
}
