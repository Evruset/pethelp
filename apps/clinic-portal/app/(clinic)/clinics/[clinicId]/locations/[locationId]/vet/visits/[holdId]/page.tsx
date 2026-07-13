import { VeterinarianVisitWorkspace } from '@/components/veterinarian/VeterinarianVisitWorkspace';
import { getClinicSession } from '@/lib/auth/clinic-session';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ clinicId: string; locationId: string; holdId: string }> };

export default async function VeterinarianVisitDetailPage({ params }: Props) {
  const { clinicId, locationId, holdId } = await params;
  const session = await getClinicSession();
  if (!session) return <Unavailable />;
  return <VeterinarianVisitWorkspace clinicId={clinicId} locationId={locationId} holdId={holdId} />;
}

function Unavailable() { return <main className="min-h-screen px-4 py-6 sm:px-8"><section className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-6"><h1 className="text-2xl font-semibold text-slate-950">Раздел недоступен</h1></section></main>; }
