export default function ForbiddenPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-12">
      <section className="w-full rounded-2xl border border-red-200 bg-white p-8 shadow-sm" aria-labelledby="forbidden-title">
        <p className="text-sm font-semibold text-red-700">403 Access Denied</p>
        <h1 id="forbidden-title" className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Нет доступа к этой локации
        </h1>
        <p className="mt-3 max-w-xl text-base leading-7 text-slate-600">
          Вернитесь к доступным локациям клиники или обратитесь к администратору VetHelp.
        </p>
      </section>
    </main>
  );
}
