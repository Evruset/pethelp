'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ClinicPatientsResponseError,
  fetchClinicPatients,
  normalizeAdministrativeReferenceSearch,
  normalizePatientSearch,
  type ClinicPatient,
} from '@/lib/api/clinic-patients';

type Props = { clinicId: string; locationId: string; referenceSearchEnabled: boolean };
type Phase = 'loading' | 'ready' | 'empty' | 'error' | 'degraded';
type Notice = 'search-unavailable' | 'rate-limited' | 'page-error' | 'refresh-error'
  | 'reference-policy' | 'reference-invariant' | 'reference-technical' | 'reference-combination' | null;

const sexLabel = (value: ClinicPatient['pet']['sexCode']) =>
  value === 'MALE' ? 'Самец' : value === 'FEMALE' ? 'Самка' : value === 'UNKNOWN' ? 'Пол не уточнён' : 'Пол не указан';
const date = (value: string | null) => value
  ? new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value))
  : 'Не указано';
const instant = (value: string | null) => value
  ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
  : 'Не было';

function PatientCard({ item, clinicId, locationId }: { item: ClinicPatient; clinicId: string; locationId: string }) {
  const href = `/clinics/${encodeURIComponent(clinicId)}/locations/${encodeURIComponent(locationId)}/patients/${encodeURIComponent(item.patientId)}`;
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
          <div className="min-w-0"><dt className="text-xs font-semibold text-slate-500">Внутренний номер</dt><dd className="mt-1 break-words text-sm text-slate-800">{item.administrativeReference ?? 'Не задан'}</dd></div>
        </dl>
        <Link href={href} className="mt-5 inline-flex min-h-11 items-center rounded-xl border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50">
          Открыть карточку пациента {item.pet.displayName}
        </Link>
      </article>
    </li>
  );
}

export function ClinicPatientsRegistry({ clinicId, locationId, referenceSearchEnabled }: Props) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [items, setItems] = useState<ClinicPatient[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchMode, setSearchMode] = useState<'ordinary' | 'reference'>('ordinary');
  const [referenceInput, setReferenceInput] = useState('');
  const [referenceQuery, setReferenceQuery] = useState('');
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [referencePending, setReferencePending] = useState(false);
  const generation = useRef(0);
  const request = useRef<AbortController | null>(null);
  const validated = useRef(false);
  const refreshButton = useRef<HTMLButtonElement>(null);
  const referenceField = useRef<HTMLInputElement>(null);
  const ordinaryField = useRef<HTMLInputElement>(null);
  const previousReferenceFlag = useRef(referenceSearchEnabled);

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
    const wasEnabled = previousReferenceFlag.current;
    previousReferenceFlag.current = referenceSearchEnabled;
    if (referenceSearchEnabled || !wasEnabled) return;
    generation.current += 1;
    request.current?.abort();
    setSearchMode('ordinary');
    setReferenceInput('');
    setReferenceQuery('');
    setReferenceError(null);
    void loadFirst(false, '');
  }, [loadFirst, referenceSearchEnabled]);

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

  const validateReference = (value: string): { value?: string; error?: string } => {
    if (/[\u0000-\u001F\u007F]/u.test(value)) {
      return { error: 'Переносы строк и управляющие символы не поддерживаются.' };
    }
    const normalized = normalizeAdministrativeReferenceSearch(value);
    const length = Array.from(normalized).length;
    if (length === 0) return { error: 'Введите внутренний номер.' };
    if (length > 40) return { error: 'Внутренний номер может содержать до 40 символов.' };
    if (!/^[\p{L}\p{Nd}._/ -]+$/u.test(normalized)) {
      return { error: 'Используйте только буквы, цифры, пробел, -, _, / и точку.' };
    }
    return { value: normalized };
  };

  const submitReference = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!referenceSearchEnabled || referencePending) return;
    const checked = validateReference(referenceInput);
    if (!checked.value) {
      setReferenceError(checked.error ?? 'Введите внутренний номер.');
      return;
    }
    const normalized = checked.value;
    setReferenceInput(normalized);
    setReferenceQuery(normalized);
    setReferenceError(null);
    setNotice(null);
    setReferencePending(true);
    const current = ++generation.current;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    try {
      const snapshot = await fetchClinicPatients({
        clinicId, locationId, administrativeReference: normalized, limit: 50, signal: controller.signal,
      });
      if (current !== generation.current || controller.signal.aborted) return;
      setItems(snapshot.items);
      setNextCursor(null);
      validated.current = true;
      setPhase(snapshot.items.length ? 'ready' : 'empty');
    } catch (error) {
      if (current !== generation.current || controller.signal.aborted) return;
      if (error instanceof ClinicPatientsResponseError) {
        if (error.status === 400 && error.code === 'INVALID_ADMINISTRATIVE_REFERENCE_QUERY') {
          setReferenceError('Используйте только буквы, цифры, пробел, -, _, / и точку.');
        } else if (error.status === 400) {
          setNotice('reference-combination');
        } else if (error.status === 404 && error.code === 'ADMINISTRATIVE_REFERENCE_SEARCH_UNAVAILABLE') {
          clearReference();
          return;
        } else if (error.status === 401 || error.status === 403 || error.status === 404) {
          setItems([]);
          setNextCursor(null);
          setPhase('error');
          return;
        } else if (error.status === 503 && error.code === 'SEARCH_INVARIANT_VIOLATION') {
          setNotice('reference-invariant');
        } else if (error.status === 503) {
          setNotice('reference-policy');
        } else {
          setNotice('reference-technical');
        }
      } else {
        setNotice('reference-technical');
      }
      if (validated.current && items.length > 0) setPhase('degraded');
    } finally {
      if (current === generation.current) setReferencePending(false);
      if (request.current === controller) request.current = null;
    }
  };

  const chooseMode = (mode: 'ordinary' | 'reference') => {
    if (mode === searchMode || (mode === 'reference' && !referenceSearchEnabled)) return;
    generation.current += 1;
    request.current?.abort();
    setNotice(null);
    setReferenceError(null);
    setReferencePending(false);
    setInput('');
    setQuery('');
    setReferenceInput('');
    setReferenceQuery('');
    setSearchMode(mode);
    if (mode === 'ordinary') void loadFirst(false, '');
    else window.requestAnimationFrame(() => referenceField.current?.focus());
  };

  const clearReference = () => {
    generation.current += 1;
    request.current?.abort();
    setReferencePending(false);
    setReferenceInput('');
    setReferenceQuery('');
    setReferenceError(null);
    setNotice(null);
    setSearchMode('ordinary');
    void loadFirst(false, '');
    window.requestAnimationFrame(() => ordinaryField.current?.focus());
  };

  return (
    <main id="main-content" className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <section aria-labelledby="patients-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Clinic Portal · Реестр</p>
            <h1 id="patients-title" className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Пациенты</h1>
            <p className="mt-2 max-w-2xl text-base text-slate-600">Безопасный административный список выбранной локации.</p>
          </div>
          <button ref={refreshButton} type="button" disabled={refreshing || referencePending}
            onClick={() => searchMode === 'reference' && referenceQuery ? void submitReference() : void loadFirst(true, query)}
            className="min-h-11 rounded-xl border border-blue-300 px-4 py-2 font-semibold text-blue-800 disabled:opacity-60">
            {refreshing ? 'Обновляем…' : 'Обновить список'}
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {referenceSearchEnabled && <fieldset>
            <legend className="text-sm font-semibold text-slate-800">Режим поиска</legend>
            <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Режим поиска пациентов">
              <button type="button" role="radio" aria-checked={searchMode === 'ordinary'} onClick={() => chooseMode('ordinary')}
                className={`min-h-11 rounded-xl border px-4 font-semibold ${searchMode === 'ordinary' ? 'border-blue-700 bg-blue-50 text-blue-900' : 'border-slate-300'}`}>
                По имени питомца
              </button>
              <button type="button" role="radio" aria-checked={searchMode === 'reference'} onClick={() => chooseMode('reference')}
                className={`min-h-11 rounded-xl border px-4 font-semibold ${searchMode === 'reference' ? 'border-blue-700 bg-blue-50 text-blue-900' : 'border-slate-300'}`}>
                Внутренний номер
              </button>
            </div>
          </fieldset>}
          {searchMode === 'ordinary' ? <>
            <label htmlFor="patient-search" className="mt-4 block text-sm font-semibold text-slate-800">Поиск по имени питомца</label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input ref={ordinaryField} id="patient-search" type="search" value={input} onChange={(event) => setInput(event.target.value)}
                aria-describedby="patient-search-help" className="min-h-11 flex-1 rounded-xl border border-slate-300 px-4 text-base"
                placeholder="Введите минимум 2 символа" />
              {input && <button type="button" onClick={() => setInput('')} className="min-h-11 rounded-xl border border-slate-300 px-4 font-semibold">Очистить</button>}
            </div>
            <p id="patient-search-help" className={`mt-2 text-sm ${invalidLength ? 'text-red-700' : 'text-slate-500'}`}>
              {invalidLength ? 'Введите от 2 до 80 символов.' : 'Только начало имени, от 2 до 80 символов.'}
            </p>
          </> : <form className="mt-4" onSubmit={(event) => void submitReference(event)}>
            <label htmlFor="reference-search" className="block text-sm font-semibold text-slate-800">Внутренний номер</label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input ref={referenceField} id="reference-search" value={referenceInput} disabled={referencePending}
                onChange={(event) => { setReferenceInput(event.target.value); setReferenceError(null); }}
                aria-invalid={Boolean(referenceError)} aria-describedby="reference-search-help reference-search-error"
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-300 px-4 text-base"
                placeholder="Например, PET-004281" />
              <button type="submit" disabled={referencePending} className="min-h-11 rounded-xl bg-blue-700 px-5 font-semibold text-white disabled:opacity-60">
                {referencePending ? 'Ищем…' : 'Найти'}
              </button>
              <button type="button" onClick={clearReference} className="min-h-11 rounded-xl border border-slate-300 px-4 font-semibold">Очистить</button>
            </div>
            <p id="reference-search-help" className="mt-2 text-sm text-slate-500">
              Точный внутренний номер пациента в текущей локации. Это не номер медицинской карты и не глобальный идентификатор пациента.
            </p>
            <p id="reference-search-error" role="alert" className="mt-2 text-sm font-medium text-red-700">{referenceError}</p>
            <p role="status" aria-live="polite" className="sr-only">{referencePending ? 'Выполняется поиск по внутреннему номеру.' : ''}</p>
          </form>}
        </div>

        <div aria-live="polite" className="mt-4">
          {notice === 'search-unavailable' && <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">Поиск временно недоступен. Полный список пациентов можно просматривать и обновлять.</p>}
          {notice === 'rate-limited' && <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">Слишком много запросов поиска. Повторите позже{retryAfter ? `, примерно через ${retryAfter} сек.` : ''}.</p>}
          {notice === 'page-error' && <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">Следующую страницу проверить не удалось. Текущий список сохранён.</p>}
          {notice === 'refresh-error' && <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">Обновление проверить не удалось. Показан последний подтверждённый список.</p>}
          {notice === 'reference-policy' && <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">Не удалось проверить доступ к пациентам. Попробуйте ещё раз. <button className="font-semibold underline" onClick={() => void submitReference()}>Повторить поиск</button></p>}
          {notice === 'reference-invariant' && <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">Поиск временно недоступен. Попробуйте позже. <button className="font-semibold underline" onClick={() => void submitReference()}>Повторить поиск</button></p>}
          {notice === 'reference-technical' && <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">Поиск выполнить не удалось. Показан последний подтверждённый список. <button className="font-semibold underline" onClick={() => void submitReference()}>Повторить поиск</button></p>}
          {notice === 'reference-combination' && <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">Не удалось выполнить поиск с текущими параметрами. Очистите фильтры и повторите попытку.</p>}
        </div>

        {phase === 'loading' && <div aria-label="Загрузка пациентов" className="mt-6 grid gap-4" aria-busy="true">
          {[1, 2, 3].map((key) => <div key={key} aria-hidden="true" className="h-48 animate-pulse rounded-2xl bg-slate-200 motion-reduce:animate-none" />)}
        </div>}
        {phase === 'error' && <section className="mt-6 rounded-2xl border border-red-200 bg-white p-8">
          <h2 className="text-xl font-semibold text-slate-950">Не удалось загрузить пациентов</h2>
          <p className="mt-2 text-sm text-slate-600">Это не пустой список. Повторите загрузку позже.</p>
          <button type="button" onClick={() => void loadFirst(false, query)} className="mt-4 min-h-11 rounded-xl bg-blue-700 px-5 font-semibold text-white">Повторить</button>
        </section>}
        {(phase === 'empty' || (phase === 'degraded' && items.length === 0)) && <section aria-live="polite" className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <h2 className="text-xl font-semibold text-slate-950">{searchMode === 'reference' && referenceQuery
            ? 'Пациент с таким внутренним номером не найден в этой локации.'
            : query ? 'По этому имени пациенты не найдены.' : 'В этой локации пока нет доступных пациентов.'}</h2>
          {searchMode === 'reference' && referenceQuery && <p className="mt-2 text-sm text-slate-600">Проверьте номер или выберите другую локацию.</p>}
        </section>}
        {items.length > 0 && <>
          <ul aria-label="Реестр пациентов" className="mt-6 grid gap-4">{items.map((item) => <PatientCard key={item.patientId} item={item} clinicId={clinicId} locationId={locationId} />)}</ul>
          {searchMode === 'ordinary' && nextCursor && <div className="mt-6 flex justify-center"><button type="button" disabled={loadingMore} onClick={() => void loadMore()}
            className="min-h-11 rounded-xl bg-blue-700 px-6 py-3 font-semibold text-white disabled:opacity-60">
            {loadingMore ? 'Загружаем…' : notice === 'page-error' ? 'Повторить загрузку' : 'Показать ещё'}
          </button></div>}
        </>}
      </section>
    </main>
  );
}
