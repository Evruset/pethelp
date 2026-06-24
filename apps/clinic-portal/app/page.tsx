export default function ClinicPortalHome() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-12">
      <section className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold text-blue-700">VetHelp</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Портал клиники
        </h1>
        <p className="mt-3 max-w-xl text-base leading-7 text-slate-600">
          Откройте разрешённую локацию из рабочего маршрута. Доступ к данным и действиям
          проверяется по сессии сотрудника и активной membership локации.
        </p>
      </section>
    </main>
  );
}
