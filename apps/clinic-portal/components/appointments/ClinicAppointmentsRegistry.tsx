'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ClinicAppointmentsResponseError,
  fetchClinicAppointments,
  type AppointmentBucket,
  type ClinicAppointment,
} from '@/lib/api/clinic-appointments';

type Props = { clinicId: string; locationId: string };
type Phase = 'loading' | 'ready' | 'empty' | 'error' | 'degraded';

const STATUS: Record<string, { label: string; className: string }> = {
  SCHEDULED: { label: 'Запланирована', className: 'border-blue-200 bg-blue-50 text-blue-800' },
  COMPLETED: { label: 'Завершена', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  NO_SHOW: { label: 'Неявка', className: 'border-amber-200 bg-amber-50 text-amber-900' },
  CANCELLED: { label: 'Отменена', className: 'border-slate-300 bg-slate-100 text-slate-700' },
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

function AppointmentCard({ item, clinicId, locationId }: { item: ClinicAppointment; clinicId: string; locationId: string }) {
  const status = STATUS[item.statusCode] ?? {
    label: 'Статус уточняется',
    className: 'border-violet-200 bg-violet-50 text-violet-800',
  };
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <article aria-labelledby={`appointment-${item.appointmentId}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <time id={`appointment-${item.appointmentId}`} dateTime={item.slot.startsAt} className="text-base font-semibold text-slate-950">
              {formatDate(item.slot.startsAt)}
            </time>
            <p className="mt-1 text-sm text-slate-500">До {formatDate(item.slot.endsAt)}</p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${status.className}`}>{status.label}</span>
        </div>
        <dl className="mt-5 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Питомец</dt>
            <dd className="mt-1 text-base font-semibold text-slate-900">{item.pet.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Вид</dt>
            <dd className="mt-1 text-sm text-slate-700">{item.pet.speciesLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Услуга</dt>
            <dd className="mt-1 text-sm text-slate-700">{item.service?.displayName ?? 'Не указана'}</dd>
          </div>
        </dl>
        <Link
          href={`/clinics/${encodeURIComponent(clinicId)}/locations/${encodeURIComponent(locationId)}/appointments/${encodeURIComponent(item.appointmentId)}`}
          className="mt-5 inline-flex min-h-11 items-center rounded-xl border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
        >
          Открыть запись
        </Link>
      </article>
    </li>
  );
}

export function ClinicAppointmentsRegistry({ clinicId, locationId }: Props) {
  const [bucket, setBucket] = useState<AppointmentBucket>('upcoming');
  const [phase, setPhase] = useState<Phase>('loading');
  const [items, setItems] = useState<ClinicAppointment[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [traversalComplete, setTraversalComplete] = useState(false);
  const [degradedContext, setDegradedContext] = useState<'refresh' | 'page'>('page');
  const generation = useRef(0);
  const request = useRef<AbortController | null>(null);
  const loadingMore = useRef(false);
  const preserveNextRefresh = useRef(false);
  const hasValidatedSnapshot = useRef(false);
  const upcomingTab = useRef<HTMLButtonElement>(null);
  const historyTab = useRef<HTMLButtonElement>(null);

  const loadInitial = useCallback(async () => {
    const current = ++generation.current;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const preserve = preserveNextRefresh.current && hasValidatedSnapshot.current;
    preserveNextRefresh.current = false;
    setNextCursor(null);
    setTraversalComplete(false);
    if (!preserve) {
      hasValidatedSnapshot.current = false;
      setItems([]);
      setPhase('loading');
    }
    try {
      const snapshot = await fetchClinicAppointments({
        clinicId, locationId, bucket, limit: 50, signal: controller.signal,
      });
      if (current !== generation.current || controller.signal.aborted) return;
      setItems(snapshot.items);
      setNextCursor(snapshot.nextCursor);
      hasValidatedSnapshot.current = true;
      setPhase(snapshot.items.length ? 'ready' : 'empty');
    } catch {
      if (current === generation.current && !controller.signal.aborted) {
        if (preserve) setDegradedContext('refresh');
        setPhase(preserve ? 'degraded' : 'error');
      }
    } finally {
      if (request.current === controller) request.current = null;
    }
  }, [bucket, clinicId, locationId]);

  useEffect(() => {
    void loadInitial();
    return () => {
      generation.current += 1;
      request.current?.abort();
    };
  }, [loadInitial, refreshKey]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore.current || phase === 'degraded') return;
    loadingMore.current = true;
    setIsLoadingMore(true);
    const current = generation.current;
    const cursor = nextCursor;
    const controller = new AbortController();
    request.current = controller;
    try {
      const snapshot = await fetchClinicAppointments({
        clinicId, locationId, bucket, limit: 50, cursor, signal: controller.signal,
      });
      if (current !== generation.current || controller.signal.aborted) return;
      const known = new Set(items.map((item) => item.appointmentId));
      if (snapshot.items.some((item) => known.has(item.appointmentId))) {
        throw new ClinicAppointmentsResponseError('malformed');
      }
      setItems((previous) => [...previous, ...snapshot.items]);
      setNextCursor(snapshot.nextCursor);
      setTraversalComplete(snapshot.nextCursor === null);
      setPhase('ready');
    } catch {
      if (current === generation.current && !controller.signal.aborted) {
        setDegradedContext('page');
        setPhase('degraded');
      }
    } finally {
      loadingMore.current = false;
      setIsLoadingMore(false);
      if (request.current === controller) request.current = null;
    }
  };

  const refresh = () => {
    preserveNextRefresh.current = hasValidatedSnapshot.current;
    generation.current += 1;
    request.current?.abort();
    setRefreshKey((value) => value + 1);
  };

  const selectBucket = (value: AppointmentBucket, focus = false) => {
    preserveNextRefresh.current = false;
    setBucket(value);
    if (focus) queueMicrotask(() => (value === 'upcoming' ? upcomingTab : historyTab).current?.focus());
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-8 lg:px-12">
      <section className="mx-auto max-w-6xl" aria-labelledby="appointments-title">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-blue-700">VetHelp · Клиника</p>
              <h1 id="appointments-title" className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Записи</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">Актуальный административный список выбранной локации.</p>
            </div>
            <button type="button" onClick={refresh} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
              Обновить список
            </button>
          </div>
          <div className="mt-6 inline-flex rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Раздел записей">
            {([
              ['upcoming', 'Предстоящие'],
              ['history', 'История'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                ref={value === 'upcoming' ? upcomingTab : historyTab}
                tabIndex={bucket === value ? 0 : -1}
                aria-selected={bucket === value}
                onClick={() => selectBucket(value)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                    event.preventDefault();
                    selectBucket(value === 'upcoming' ? 'history' : 'upcoming', true);
                  }
                }}
                className={`min-h-11 rounded-lg px-4 py-2 text-sm font-semibold ${bucket === value ? 'bg-white text-blue-800 shadow-sm' : 'text-slate-600'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        <p className="sr-only" role="status" aria-live="polite">
          {phase === 'loading' ? 'Загрузка записей' : phase === 'degraded' ? 'Показан последний подтверждённый список' : ''}
        </p>
        <div className="mt-5" aria-busy={phase === 'loading'}>
          {phase === 'loading' && (
            <section className="rounded-2xl border border-slate-200 bg-white p-8">
              <p className="font-semibold text-slate-700">Загружаем записи…</p>
            </section>
          )}
          {phase === 'error' && (
            <section role="alert" className="rounded-2xl border border-red-200 bg-white p-8">
              <h2 className="text-xl font-semibold text-slate-950">Не удалось загрузить записи</h2>
              <p className="mt-2 text-sm text-slate-600">Это техническая ошибка, а не пустой список.</p>
              <button type="button" onClick={refresh} className="mt-5 min-h-11 rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white">Повторить</button>
            </section>
          )}
          {phase === 'degraded' && (
            <section role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
              <p className="font-semibold text-amber-950">
                {degradedContext === 'refresh' ? 'Обновление списка проверить не удалось' : 'Следующую страницу проверить не удалось'}
              </p>
              <p className="mt-1 text-sm text-amber-900">Показан последний подтверждённый список. Обновите его, чтобы начать новый проход.</p>
            </section>
          )}
          {(phase === 'empty' || (phase === 'degraded' && items.length === 0)) && (
            <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
              <h2 className="text-xl font-semibold text-slate-950">
                {bucket === 'upcoming' ? 'Предстоящих записей нет' : 'История записей пуста'}
              </h2>
              <p className="mt-2 text-sm text-slate-600">Сервер подтвердил, что в выбранном разделе пока нет записей.</p>
            </section>
          )}
          {items.length > 0 && (
            <>
              <ul className="grid gap-4" aria-label={bucket === 'upcoming' ? 'Предстоящие записи' : 'История записей'}>
                {items.map((item) => <AppointmentCard key={item.appointmentId} item={item} clinicId={clinicId} locationId={locationId} />)}
              </ul>
              {(nextCursor || traversalComplete || phase === 'degraded') && (
                <div className="mt-6 flex justify-center">
                  <button
                    type="button"
                    onClick={() => void loadMore()}
                    disabled={isLoadingMore || traversalComplete || phase === 'degraded'}
                    className="min-h-11 rounded-xl bg-blue-700 px-6 py-3 font-semibold text-white disabled:cursor-wait disabled:opacity-60"
                  >
                    {isLoadingMore ? 'Загружаем…' : traversalComplete ? 'Все записи загружены' : phase === 'degraded' ? 'Загрузка остановлена' : 'Показать ещё'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
