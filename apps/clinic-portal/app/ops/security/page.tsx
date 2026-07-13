import { redirect } from 'next/navigation';
import { OpsSecurityCapabilityGate } from '@/components/ops/OpsSecurityCapabilityGate';
import { getOpsAuditEvents, getOpsSloSnapshot, OpsSloBackendError } from '@/lib/api/ops-slo';
import { canAccessOps, getClinicSession } from '@/lib/auth/clinic-session';
import { getEffectiveSession, hasCapability } from '@/lib/auth/effective-session';

export const dynamic = 'force-dynamic';

function Unavailable() { return <main className="min-h-screen px-6 py-12"><section className="rounded-lg border border-amber-200 bg-white p-8"><p className="text-sm font-semibold text-amber-700">Operational dashboard временно недоступен</p><h1 className="mt-2 text-3xl font-semibold">Не удалось получить operational snapshot</h1></section></main>; }

export default async function OpsSecurityPage() {
  const session = await getClinicSession();
  if (!session || !canAccessOps(session)) redirect('/forbidden');
  let effectiveSession;
  try { effectiveSession = await getEffectiveSession(session); } catch { return <Unavailable />; }
  if (!hasCapability(effectiveSession, 'ops.slo.snapshot.read')) redirect('/forbidden');
  try {
    const [snapshot, auditEvents] = await Promise.all([getOpsSloSnapshot(session), getOpsAuditEvents(session, 25)]);
    return <OpsSecurityCapabilityGate snapshot={snapshot} auditEvents={auditEvents} />;
  } catch (error) {
    if (error instanceof OpsSloBackendError && error.status === 403) redirect('/forbidden');
    return <Unavailable />;
  }
}
