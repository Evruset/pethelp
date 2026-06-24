export default function QueueLoading() {
  return (
    <main className="min-h-screen px-4 py-6 sm:px-8 lg:px-12" aria-label="Загрузка очереди">
      <section className="mx-auto max-w-7xl animate-pulse">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="h-4 w-28 rounded bg-slate-200" />
          <div className="mt-3 h-8 w-72 rounded bg-slate-200" />
          <div className="mt-3 h-4 w-96 max-w-full rounded bg-slate-100" />
        </div>
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="h-12 bg-slate-100" />
          {Array.from({ length: 12 }).map((_, index) => (
            <div key={index} className="grid h-20 grid-cols-7 gap-4 border-t border-slate-200 px-4 py-4">
              {Array.from({ length: 7 }).map((__, cellIndex) => (
                <div key={cellIndex} className="rounded bg-slate-100" />
              ))}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
