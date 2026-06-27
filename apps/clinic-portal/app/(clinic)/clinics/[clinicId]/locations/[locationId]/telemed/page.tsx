import { getClinicSession } from '@/lib/auth/clinic-session';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

function AccessDenied() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-12">
      <section className="w-full rounded-lg border border-red-200 bg-white p-8">
        <p className="text-sm font-semibold text-red-700">403 Access Denied</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Нет доступа к telemed workspace</h1>
        <p className="mt-3 text-base leading-7 text-slate-600">
          Ветеринарная очередь — platform workspace и не принадлежит конкретной клинике или локации.
        </p>
      </section>
    </main>
  );
}

export default async function LegacyTelemedWorkspacePage() {
  const session = await getClinicSession();
  if (session?.roles.includes('TELEMED_VETERINARIAN')) redirect('/telemed/vet');
  return <AccessDenied />;
}
