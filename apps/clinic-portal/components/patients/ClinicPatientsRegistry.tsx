'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ClinicPatientsResponseError,
  fetchClinicPatients,
  normalizePatientSearch,
  type ClinicPatient,
} from '@/lib/api/clinic-patients';

type Props = { clinicId: string; locationId: string };
type Phase = 'loading' | 'ready' | 'empty' | 'error' | 'degraded';
type Notice = 'search-unavailable' | 'rate-limited' | 'page-error' | 'refresh-error' | null;

const sexLabel = (value: ClinicPatient['pet']['sexCode']) =>
  value === 'MALE' ? 'Самец' : value === 'FEMALE' ? 'Самка' : value === 'UNKNOWN' ? 'Пол не уточнён' : 'Пол не указан';
const date = (value: string | null) => value
  ? new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value))
  : 'Не указано';
const instant = (value: string | null) => value
  ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
  : 'Не было';

function PatientCard({ item }: { item: ClinicPatient }) {
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <article aria-labelledby={`patient-${item.patientId}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{item.pet.speciesLabel}</p>
            <h2 id={`patient-${item.patientId}`} className="mt-1 text-xl font-semibold text-slate-950">{item.pet.displayName}</h2>
            <p className="mt-1 text-sm text-slate-600">{item.owner.displayName ?? 'Владелец не указан'}</p>
          </div>
          <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-700">
            {sexLabel(item.pet.sexCode)}
          </span>
        </div>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-xs font-semibold text-slate-500">Порода</dt><dd className="mt-1 text-sm text-slate-800">{item.pet.breed ?? 'Не указана'}</dd></div>
          <div><dt className="text-xs font-semibold text-slate-500">Дата рождения</dt><dd className="mt-1 text-sm text-slate-800">{date(item.pet.birthDate)}</dd></div>
          <div><dt className="text-xs font-semibold text-slate-500">Первое обращение</dt><dd className="mt-1 text-sm text-slate-800">{instant(item.relationship.firstSeenAt)}</dd></div>
          <div><dt className="text-xs font-semibold text-slate-500">Последнее обращение</dt><dd className="mt-1 text-sm text-slate-800">{instant(item.relationship.lastSeenAt)}</dd></div>
          <div><dt className="text-xs font-semibold text-slate-500">Последний визит</dt><dd className="mt-1 text-sm text-slate-800">{instant(item.appointments.lastVisitAt)}</dd></div>
          <div><dt className="text-xs font-semibold text-slate-500">Следующая запись</dt><dd className="mt-1 text-sm text-slate-800">{instant(item.appointments.nextAppointmentAt)}</dd></div>
        </dl>
      </article>
    </li>
  );
}

export function ClinicPatientsRegistry({ clinicId, locationId }: Props) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [items, setItems] = useState<ClinicPatient[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const generation = useRef(0);
  const request = useRef<AbortController | null>(null);
  const validated = useRef(false);
  const refreshButton = useRef<HTMLButtonElement>(null);

  const loadFirst = useCallback(async (preserve: boolean, search: string) => {
    const current = ++generation.current;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setNotice(null);
    setRetryAfter(null);
    if (!preserve || !validated.current) {
      setItems([]);
      setPhase('loading');
    } else {
      setRefreshing(true);
    }
    try {
      const snapshot = await fetchClinicPatients({
        clinicId, locationId, q: search || undefined, limit: 50, signal: controller.signal,
      });
      if (current !== generation.current || controller.signal.aborted) return;
      setItems(snapshot.items);
      setNextCursor(snapshot.nextCursor);
      validated.current = true;
      setPhase(snapshot.items.length ? 'ready' : 'empty');
    } catch (error) {
      if (current !== generation.current || controller.signal.aborted) return;
      if (error instanceof ClinicPatientsResponseError && error.status === 503 && search) {
        setNotice('search-unavailable');
      } else if (error instanceof ClinicPatientsResponseError && error.status === 429) {
        setRetryAfter(error.retryAfter ?? null);
        setNotice('rate-limited');
      } else {
        setNotice(preserve && validated.current ? 'refresh-error' : null);
      }
      setPhase(preserve && validated.current ? 'degraded' : 'error');
    } finally {
      if (current === generation.current) setRefreshing(false);
      if (request.current === controller) request.current = null;
    }
  }, [clinicId, locationId]);

  useEffect(() => {
    void loadFirst(false, '');
    return () => {
      generation.current += 1;
      request.current?.abort();
    };
  }, [loadFirst]);

  useEffect(() => {
    const normalized = normalizePatientSearch(input);
    const length = Array.from(normalized).length;
    if (input.length > 0 && (length < 2 || length > 80)) {
      generation.current += 1;
      request.current?.abort();
      return;
    }
    const timer = window.setTimeout(() => {
      if (normalized === query) return;
      setQuery(normalized);
      validated.current = items.length > 0 || phase === 'empty';
      void loadFirst(validated.current, normalized);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [input, items.length, loadFirst, phase, query]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setNotice(null);
    const current = generation.current;
    const controller = new AbortController();
    request.current = controller;
    try {
      const snapshot = await fetchClinicPatients({
        clinicId, locationId, q: query || undefined, limit: 50, cursor: nextCursor, signal: controller.signal,
      });
      if (current !== generation.current || controller.signal.aborted) return;
      const ids = new Set(items.map((item) => item.patientId));
      if (snapshot.items.some((item) => ids.has(item.patientId))) throw new ClinicPatientsResponseError('malformed');
      setItems((currentItems) => [...currentItems, ...snapshot.items]);
      setNextCursor(snapshot.nextCursor);
    } catch {
      if (current === generation.current && !controller.signal.aborted) setNotice('page-error');
    } finally {
      setLoadingMore(false);
      if (request.current === controller) request.current = null;
    }
  };

  const invalidLength = input.length > 0 && (Array.from(normalizePatientSearch(input)).length < 2
    || Array.from(normalizePatientSearch(input)).length > 80);

  return (
    <main id="main-content" className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <section aria-labelledby="patients-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Clinic Portal · Реестр</p>
            <h1 id="patients-title" className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Пациенты</h1>
            <p className="mt-2 max-w-2xl text-base text-slate-600">Безопасный административный список выбранной локации.</p>
          </div>
          <button ref={refreshButton} type="button" disabled={refreshing} onClick={() => void loadFirst(true, query)}
            className="min-h-11 rounded-xl border border-blue-300 px-4 py-2 font-semibold text-blue-800 disabled:opacity-60">
            {refreshing ? 'Обновляем…' : 'Обновить список'}
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <label htmlFor="patient-search" className="block text-sm font-semibold text-slate-800">Поиск по имени питомца</label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input id="patient-search" type="search" value={input} onChange={(event) => setInput(event.target.value)}
              aria-describedby="patient-search-help" className="min-h-11 flex-1 rounded-xl border border-slate-300 px-4 text-base"
              placeholder="Введите минимум 2 символа" />
            {input && <button type="button" onClick={() => setInput('')} className="min-h-11 rounded-xl border border-slate-300 px-4 font-semibold">Очистить</button>}
          </div>
          <p id="patient-search-help" className={`mt-2 text-sm ${invalidLength ? 'text-red-700' : 'text-slate-500'}`}>
            {invalidLength ? 'Введите от 2 до 80 символов.' : 'Только начало имени, от 2 до 80 символов.'}
          </p>
        </div>

        <div aria-live="polite" className="mt-4">
          {notice === 'search-unavailable' && <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">Поиск временно недоступен. Полный список пациентов можно просматривать и обновлять.</p>}
          {notice === 'rate-limited' && <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">Слишком много запросов поиска. Повторите позже{retryAfter ? `, примерно через ${retryAfter} сек.` : ''}.</p>}
          {notice === 'page-error' && <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">Следующую страницу проверить не удалось. Текущий список сохранён.</p>}
          {notice === 'refresh-error' && <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">Обновление проверить не удалось. Показан последний подтверждённый список.</p>}
        </div>

        {phase === 'loading' && <div aria-label="Загрузка пациентов" className="mt-6 grid gap-4" aria-busy="true">
          {[1, 2, 3].map((key) => <div key={key} aria-hidden="true" className="h-48 animate-pulse rounded-2xl bg-slate-200 motion-reduce:animate-none" />)}
        </div>}
        {phase === 'error' && <section className="mt-6 rounded-2xl border border-red-200 bg-white p-8">
          <h2 className="text-xl font-semibold text-slate-950">Не удалось загрузить пациентов</h2>
          <p className="mt-2 text-sm text-slate-600">Это не пустой список. Повторите загрузку позже.</p>
          <button type="button" onClick={() => void loadFirst(false, query)} className="mt-4 min-h-11 rounded-xl bg-blue-700 px-5 font-semibold text-white">Повторить</button>
        </section>}
        {(phase === 'empty' || (phase === 'degraded' && items.length === 0)) && <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <h2 className="text-xl font-semibold text-slate-950">{query ? 'По этому имени пациенты не найдены.' : 'В этой локации пока нет доступных пациентов.'}</h2>
        </section>}
        {items.length > 0 && <>
          <ul aria-label="Реестр пациентов" className="mt-6 grid gap-4">{items.map((item) => <PatientCard key={item.patientId} item={item} />)}</ul>
          {nextCursor && <div className="mt-6 flex justify-center"><button type="button" disabled={loadingMore} onClick={() => void loadMore()}
            className="min-h-11 rounded-xl bg-blue-700 px-6 py-3 font-semibold text-white disabled:opacity-60">
            {loadingMore ? 'Загружаем…' : notice === 'page-error' ? 'Повторить загрузку' : 'Показать ещё'}
          </button></div>}
        </>}
      </section>
    </main>
  );
}
