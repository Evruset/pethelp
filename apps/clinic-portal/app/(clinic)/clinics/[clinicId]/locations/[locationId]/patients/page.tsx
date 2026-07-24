import { notFound } from 'next/navigation';
import { isClinicPatientsRegistryEnabled } from '@/app/design-system/feature-flags';
import { ClinicPatientsRegistry } from '@/components/patients/ClinicPatientsRegistry';
import { canAccessClinicLocation, getClinicSession } from '@/lib/auth/clinic-session';
import { getEffectiveSession, hasCapability, hasClinicScope } from '@/lib/auth/effective-session';

export const dynamic = 'force-dynamic';
type PageProps = { params: Promise<{ clinicId: string; locationId: string }> };

function State({ denied = false }: { denied?: boolean }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-12">
      <section className={`w-full rounded-2xl border bg-white p-8 shadow-sm ${denied ? 'border-red-200' : 'border-amber-200'}`}>
        <p className={`text-sm font-semibold ${denied ? 'text-red-700' : 'text-amber-700'}`}>
          {denied ? '403 Access Denied' : 'Раздел временно недоступен'}
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">
          {denied ? 'Нет доступа к пациентам этой локации' : 'Не удалось проверить доступ'}
        </h1>
        <p className="mt-3 text-base text-slate-600">
          {denied ? 'Вернитесь к доступным локациям клиники.' : 'Обновите страницу после восстановления соединения.'}
        </p>
      </section>
    </main>
  );
}

export default async function ClinicPatientsPage({ params }: PageProps) {
  if (!isClinicPatientsRegistryEnabled()) notFound();
  const { clinicId, locationId } = await params;
  const session = await getClinicSession();
  if (!session || !canAccessClinicLocation(session, clinicId, locationId)) return <State denied />;
  try {
    const effective = await getEffectiveSession(session);
    if (!hasCapability(effective, 'patient.admin.read') || !hasClinicScope(effective, clinicId, locationId)) {
      return <State denied />;
    }
    return <ClinicPatientsRegistry clinicId={clinicId} locationId={locationId} />;
  } catch {
    return <State />;
  }
}
