import { notFound } from 'next/navigation';
import { ClinicAppointmentDetail } from '@/components/appointments/ClinicAppointmentDetail';
import { isClinicAppointmentsRegistryEnabled } from '@/app/design-system/feature-flags';
import { canAccessClinicLocation, getClinicSession } from '@/lib/auth/clinic-session';
import { getEffectiveSession, hasCapability, hasClinicScope } from '@/lib/auth/effective-session';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ clinicId: string; locationId: string; appointmentId: string }> };

function State({ unavailable = false }: { unavailable?: boolean }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-12">
      <section className={`w-full rounded-2xl border bg-white p-8 shadow-sm ${unavailable ? 'border-amber-200' : 'border-red-200'}`}>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          {unavailable ? 'Не удалось проверить доступ' : 'Запись недоступна или не найдена'}
        </h1>
        <p className="mt-3 text-base leading-7 text-slate-600">
          {unavailable ? 'Обновите страницу после восстановления соединения.' : 'Вернитесь к доступным записям выбранной локации.'}
        </p>
      </section>
    </main>
  );
}

export default async function ClinicAppointmentDetailPage({ params }: PageProps) {
  if (!isClinicAppointmentsRegistryEnabled()) notFound();
  const { clinicId, locationId, appointmentId } = await params;
  const session = await getClinicSession();
  if (!session || !canAccessClinicLocation(session, clinicId, locationId)) return <State />;
  try {
    const effective = await getEffectiveSession(session);
    if (!hasCapability(effective, 'appointment.registry.read')
      || !hasClinicScope(effective, clinicId, locationId)) return <State />;
    return <ClinicAppointmentDetail clinicId={clinicId} locationId={locationId} appointmentId={appointmentId} />;
  } catch {
    return <State unavailable />;
  }
}
