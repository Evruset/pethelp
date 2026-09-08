import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isClinicPatientsRegistryEnabled } from '@/app/design-system/feature-flags';
import { ClinicPatientDetailView } from '@/components/patients/ClinicPatientDetail';
import { canAccessClinicLocation, getClinicSession } from '@/lib/auth/clinic-session';
import { getEffectiveSession, hasCapability, hasClinicScope } from '@/lib/auth/effective-session';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Props = { params: Promise<{ clinicId: string; locationId: string; patientId: string }> };
function Denied({ clinicId, locationId, unavailable = false }: { clinicId: string; locationId: string; unavailable?: boolean }) {
  const back = `/clinics/${encodeURIComponent(clinicId)}/locations/${encodeURIComponent(locationId)}/patients`;
  return <main id="main-content" className="mx-auto min-h-screen max-w-3xl px-6 py-12">
    <Link href={back} className="inline-flex min-h-11 items-center rounded-xl px-2 text-sm font-semibold text-blue-800 hover:bg-blue-50">← Вернуться к пациентам</Link>
    <section className="mt-3 w-full rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
    <h1 className="text-3xl font-semibold text-slate-950">{unavailable ? 'Не удалось проверить доступ' : 'Нет доступа к карточке пациента'}</h1>
    <p className="mt-3 text-slate-600">{unavailable ? 'Обновите страницу после восстановления соединения.' : 'Вернитесь к пациентам доступной локации.'}</p>
  </section></main>;
}
export default async function ClinicPatientDetailPage({ params }: Props) {
  if (!isClinicPatientsRegistryEnabled()) notFound();
  const { clinicId, locationId, patientId } = await params;
  if (!UUID.test(patientId)) return <ClinicPatientDetailView clinicId={clinicId} locationId={locationId} patientId={patientId} invalid />;
  const session = await getClinicSession();
  if (!session || !UUID.test(clinicId) || !UUID.test(locationId) || !canAccessClinicLocation(session, clinicId, locationId)) return <Denied clinicId={clinicId} locationId={locationId} />;
  try {
    const effective = await getEffectiveSession(session);
    if (!hasCapability(effective, 'patient.admin.read') || !hasClinicScope(effective, clinicId, locationId)) return <Denied clinicId={clinicId} locationId={locationId} />;
    const canEditLocalAlias = process.env.VETHELP_CLINIC_PATIENT_ADMIN_MUTATIONS === 'true'
      && hasCapability(effective, 'patient.admin.local-profile.update')
      && hasClinicScope(effective, clinicId, locationId);
    return <ClinicPatientDetailView clinicId={clinicId} locationId={locationId} patientId={patientId} canEditLocalAlias={canEditLocalAlias} />;
  } catch {
    return <Denied clinicId={clinicId} locationId={locationId} unavailable />;
  }
}
