import { TelemedVetQueueCapabilityGate } from '@/components/telemed/TelemedVetQueueCapabilityGate';
import { getTelemedVetQueue, TelemedVetBackendError } from '@/lib/api/telemed-vet';
import { getClinicSession } from '@/lib/auth/clinic-session';
import { isTelemedVeterinarian } from '@/lib/auth/telemed-vet-session';
import { getEffectiveSession, hasCapability } from '@/lib/auth/effective-session';

export const dynamic = 'force-dynamic';

function AccessDenied() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-12">
      <section className="w-full rounded-lg border border-red-200 bg-white p-8">
        <p className="text-sm font-semibold text-red-700">403 Access Denied</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Нет доступа к очереди телемедицины</h1>
        <p className="mt-3 text-base leading-7 text-slate-600">
          Доступ к очереди есть только у назначенных ветеринаров телемедицинской платформы.
        </p>
      </section>
    </main>
  );
}

function ServiceUnavailable() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-12">
      <section className="w-full rounded-lg border border-amber-200 bg-white p-8">
        <p className="text-sm font-semibold text-amber-700">Telemed workspace временно недоступен</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Не удалось получить очередь</h1>
        <p className="mt-3 text-base leading-7 text-slate-600">Проверьте подключение к VetHelp и обновите страницу.</p>
      </section>
    </main>
  );
}

export default async function PlatformTelemedVetQueuePage() {
  const session = await getClinicSession();
  if (!isTelemedVeterinarian(session)) return <AccessDenied />;
  try {
    const effectiveSession = await getEffectiveSession(session);
    if (!hasCapability(effectiveSession, 'telemed.vet.queue.read')) return <AccessDenied />;
  } catch {
    return <ServiceUnavailable />;
  }
  try {
    const queue = await getTelemedVetQueue(session);
    return <TelemedVetQueueCapabilityGate initialQueue={queue} />;
  } catch (error) {
    if (error instanceof TelemedVetBackendError && error.status === 403) return <AccessDenied />;
    return <ServiceUnavailable />;
  }
}
