'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchPatientDetail, mutatePatientAdministrativeReference, mutatePatientLocalProfile,
  normalizeAdministrativeReference, normalizePatientAlias,
  PatientDetailResponseError, PatientLocalProfileMutationError,
  type PatientAppointment, type PatientDetail,
} from '@/lib/api/clinic-patient-detail';

type Props = { clinicId: string; locationId: string; patientId: string; invalid?: boolean; canEditLocalAlias?: boolean };
type Phase = 'loading' | 'ready' | 'not-found' | 'denied' | 'policy' | 'error' | 'malformed' | 'degraded';
const sex = (value: PatientDetail['patient']['pet']['sexCode']) =>
  value === 'MALE' ? 'Самец' : value === 'FEMALE' ? 'Самка' : value === 'UNKNOWN' ? 'Пол не уточнён' : 'Пол не указан';
const date = (value: string | null) => value ? new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric', month: 'long', year: 'numeric',
}).format(new Date(value)) : 'Не указана';
const instant = (value: string) => new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
}).format(new Date(value));
function Fact({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm text-slate-800">{value}</dd></div>;
}
function Appointment({ item, clinicId, locationId }: { item: PatientAppointment; clinicId: string; locationId: string }) {
  const href = `/clinics/${encodeURIComponent(clinicId)}/locations/${encodeURIComponent(locationId)}/appointments/${encodeURIComponent(item.appointmentId)}`;
  return <li className="rounded-xl border border-slate-200 p-4">
    <div className="flex flex-wrap items-start justify-between gap-2"><div>
      <p className="font-semibold text-slate-950">{instant(item.startsAt)}</p>
      <p className="mt-1 text-sm text-slate-600">{item.service.displayName ?? 'Услуга не указана'}</p>
    </div><span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-800">{item.statusLabel}</span></div>
    <p className="mt-2 text-sm text-slate-600">Ветеринар: {item.veterinarian.displayName ?? 'не указан'}</p>
    <Link href={href} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-blue-800 hover:underline">Открыть запись</Link>
  </li>;
}
function Message({ title, text, retry, headingRef }: { title: string; text: string; retry?: () => void; headingRef?: React.RefObject<HTMLHeadingElement | null> }) {
  return <section role="alert" className="rounded-2xl border border-red-200 bg-white p-8">
    <h2 ref={headingRef} tabIndex={headingRef ? -1 : undefined} className="text-xl font-semibold text-slate-950 outline-none">{title}</h2>
    <p className="mt-2 text-sm text-slate-600">{text}</p>
    {retry && <button type="button" onClick={retry} className="mt-5 min-h-11 rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white">Повторить</button>}
  </section>;
}
function AppointmentBlock({ title, item, clinicId, locationId }: {
  title: string; item: PatientAppointment | null; clinicId: string; locationId: string;
}) {
  return <div><h3 className="text-base font-semibold text-slate-950">{title}</h3>
    {item ? <ul className="mt-3"><Appointment item={item} clinicId={clinicId} locationId={locationId} /></ul>
      : <p className="mt-3 text-sm text-slate-600">Запись отсутствует.</p>}
  </div>;
}

export function ClinicPatientDetailView({ clinicId, locationId, patientId, invalid = false, canEditLocalAlias = false }: Props) {
  const [detail, setDetail] = useState<PatientDetail | null>(null);
  const [phase, setPhase] = useState<Phase>(invalid ? 'not-found' : 'loading');
  const [refreshing, setRefreshing] = useState(false);
  const generation = useRef(0);
  const request = useRef<AbortController | null>(null);
  const valid = useRef<PatientDetail | null>(null);
  const stateHeading = useRef<HTMLHeadingElement>(null);
  const aliasInput = useRef<HTMLTextAreaElement>(null);
  const aliasEditButton = useRef<HTMLButtonElement>(null);
  const referenceInput = useRef<HTMLInputElement>(null);
  const referenceEditButton = useRef<HTMLButtonElement>(null);
  const [aliasEditorOpen, setAliasEditorOpen] = useState(false);
  const [aliasInputValue, setAliasInputValue] = useState('');
  const [aliasPending, setAliasPending] = useState(false);
  const [aliasError, setAliasError] = useState<string | null>(null);
  const [aliasMessage, setAliasMessage] = useState<string | null>(null);
  const [referenceEditorOpen, setReferenceEditorOpen] = useState(false);
  const [referenceInputValue, setReferenceInputValue] = useState('');
  const [referencePending, setReferencePending] = useState(false);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [referenceMessage, setReferenceMessage] = useState<string | null>(null);
  const [writeAvailable, setWriteAvailable] = useState(canEditLocalAlias);
  const aliasIntent = useRef<{ scope: string; payload: string; key: string } | null>(null);
  const referenceIntent = useRef<{ scope: string; payload: string; key: string } | null>(null);

  const load = useCallback(async (manual = false) => {
    if (invalid) return;
    const current = ++generation.current;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    if (valid.current) setRefreshing(true);
    else setPhase('loading');
    try {
      const next = await fetchPatientDetail({ clinicId, locationId, patientId, signal: controller.signal });
      if (current !== generation.current || controller.signal.aborted) return;
      valid.current = next;
      setDetail(next);
      setPhase('ready');
    } catch (error) {
      if (current !== generation.current || controller.signal.aborted) return;
      const response = error instanceof PatientDetailResponseError ? error : null;
      if (response?.status === 403 || response?.status === 404) {
        valid.current = null;
        setDetail(null);
        setPhase(response.status === 403 ? 'denied' : 'not-found');
      } else if (valid.current && manual) {
        setPhase('degraded');
      } else if (response?.kind === 'malformed') setPhase('malformed');
      else if (response?.status === 503) setPhase('policy');
      else setPhase('error');
    } finally {
      if (current === generation.current) setRefreshing(false);
      if (request.current === controller) request.current = null;
    }
  }, [clinicId, invalid, locationId, patientId]);
  useEffect(() => {
    if (!invalid) void load();
    return () => { generation.current += 1; request.current?.abort(); };
  }, [invalid, load]);
  useEffect(() => {
    if (phase === 'not-found' || phase === 'denied') stateHeading.current?.focus();
  }, [phase]);
  useEffect(() => setWriteAvailable(canEditLocalAlias), [canEditLocalAlias]);
  useEffect(() => {
    aliasIntent.current = null;
    referenceIntent.current = null;
    setAliasEditorOpen(false);
    setReferenceEditorOpen(false);
  }, [clinicId, locationId, patientId]);
  useEffect(() => {
    if (aliasEditorOpen) aliasInput.current?.focus();
  }, [aliasEditorOpen]);
  useEffect(() => {
    if (referenceEditorOpen) referenceInput.current?.focus();
  }, [referenceEditorOpen]);

  const closeAliasEditor = useCallback(() => {
    if (aliasPending) return;
    setAliasEditorOpen(false);
    setAliasError(null);
    aliasIntent.current = null;
    requestAnimationFrame(() => aliasEditButton.current?.focus());
  }, [aliasPending]);
  const openAliasEditor = () => {
    setAliasInputValue(detail?.patient.localProfile.alias ?? '');
    setAliasError(null);
    setAliasMessage(null);
    aliasIntent.current = null;
    setAliasEditorOpen(true);
  };
  const saveAlias = async (clear = false) => {
    if (!detail || aliasPending || referencePending) return;
    let alias: string | null = null;
    if (!clear) {
      const normalized = normalizePatientAlias(aliasInputValue);
      if (normalized.error) {
        setAliasError(normalized.error);
        return;
      }
      alias = normalized.value as string;
    }
    const scope = `${clinicId}:${locationId}:${patientId}`;
    const payload = clear ? 'CLEAR' : `SET:${alias}`;
    if (!aliasIntent.current || aliasIntent.current.scope !== scope || aliasIntent.current.payload !== payload) {
      aliasIntent.current = { scope, payload, key: crypto.randomUUID() };
    }
    setAliasPending(true);
    setAliasError(null);
    setAliasMessage(null);
    try {
      const result = await mutatePatientLocalProfile({
        clinicId, locationId, patientId, alias,
        aggregateVersion: detail.patient.localProfile.aggregateVersion,
        idempotencyKey: aliasIntent.current.key,
      });
      const next: PatientDetail = {
        ...detail,
        patient: { ...detail.patient, localProfile: {
          alias: result.alias,
          administrativeReference: detail.patient.localProfile.administrativeReference,
          aggregateVersion: result.aggregateVersion, updatedAt: result.updatedAt,
        } },
      };
      valid.current = next;
      setDetail(next);
      setAliasEditorOpen(false);
      aliasIntent.current = null;
      setAliasMessage(clear ? 'Имя в клинике удалено.' : 'Имя в клинике сохранено.');
      requestAnimationFrame(() => aliasEditButton.current?.focus());
    } catch (error) {
      const failure = error instanceof PatientLocalProfileMutationError ? error : new PatientLocalProfileMutationError('network');
      if (failure.status === 409 && ['PATIENT_VERSION_STALE', 'PATIENT_ASSOCIATION_CHANGED'].includes(failure.code ?? '')) {
        aliasIntent.current = null;
        setAliasEditorOpen(false);
        setAliasMessage('Данные пациента изменились. Карточка обновлена — проверьте имя и повторите действие.');
        await load(true);
      } else if (failure.status === 403) {
        aliasIntent.current = null;
        referenceIntent.current = null;
        setAliasEditorOpen(false);
        setReferenceEditorOpen(false);
        setWriteAvailable(false);
        setAliasMessage('Изменение сейчас недоступно. Карточка остаётся доступна для просмотра.');
      } else if (failure.status === 404) {
        aliasIntent.current = null;
        referenceIntent.current = null;
        setAliasEditorOpen(false);
        setReferenceEditorOpen(false);
        valid.current = null;
        setDetail(null);
        setPhase('not-found');
      } else if (failure.status === 422) {
        setAliasError('Не удалось сохранить имя. Проверьте значение и повторите попытку.');
      } else if (failure.status === 503 && failure.code === 'POLICY_TEMPORARILY_UNAVAILABLE') {
        setAliasError('Не удалось проверить доступ к изменению. Попробуйте ещё раз.');
      } else {
        setAliasError('Не удалось сохранить имя. Последние подтверждённые данные не изменены — попробуйте ещё раз.');
      }
    } finally {
      setAliasPending(false);
    }
  };

  const closeReferenceEditor = useCallback(() => {
    if (referencePending) return;
    setReferenceEditorOpen(false);
    setReferenceError(null);
    referenceIntent.current = null;
    requestAnimationFrame(() => referenceEditButton.current?.focus());
  }, [referencePending]);
  const openReferenceEditor = () => {
    setReferenceInputValue(detail?.patient.localProfile.administrativeReference ?? '');
    setReferenceError(null);
    setReferenceMessage(null);
    referenceIntent.current = null;
    setReferenceEditorOpen(true);
  };
  const saveReference = async (clear = false) => {
    if (!detail || aliasPending || referencePending) return;
    let administrativeReference: string | null = null;
    if (!clear) {
      const normalized = normalizeAdministrativeReference(referenceInputValue);
      if (normalized.error) {
        setReferenceError(normalized.error);
        return;
      }
      administrativeReference = normalized.value as string;
    }
    const scope = `${clinicId}:${locationId}:${patientId}`;
    const payload = clear ? 'CLEAR' : `SET:${administrativeReference}`;
    if (!referenceIntent.current || referenceIntent.current.scope !== scope || referenceIntent.current.payload !== payload) {
      referenceIntent.current = { scope, payload, key: crypto.randomUUID() };
    }
    setReferencePending(true);
    setReferenceError(null);
    setReferenceMessage(null);
    try {
      const result = await mutatePatientAdministrativeReference({
        clinicId, locationId, patientId, administrativeReference,
        aggregateVersion: detail.patient.localProfile.aggregateVersion,
        idempotencyKey: referenceIntent.current.key,
        currentAlias: detail.patient.localProfile.alias,
      });
      const next: PatientDetail = {
        ...detail,
        patient: { ...detail.patient, localProfile: {
          alias: detail.patient.localProfile.alias, administrativeReference: result.administrativeReference,
          aggregateVersion: result.aggregateVersion, updatedAt: result.updatedAt,
        } },
      };
      valid.current = next;
      setDetail(next);
      setReferenceEditorOpen(false);
      referenceIntent.current = null;
      setReferenceMessage(clear ? 'Внутренний номер очищен.' : 'Внутренний номер сохранён.');
      requestAnimationFrame(() => referenceEditButton.current?.focus());
    } catch (error) {
      const failure = error instanceof PatientLocalProfileMutationError ? error : new PatientLocalProfileMutationError('network');
      if (failure.status === 409 && failure.code === 'ADMINISTRATIVE_REFERENCE_ALREADY_IN_USE') {
        setReferenceError('Такой внутренний номер уже используется в этой локации.');
      } else if (failure.status === 409 && ['PATIENT_VERSION_STALE', 'PATIENT_ASSOCIATION_CHANGED'].includes(failure.code ?? '')) {
        referenceIntent.current = null;
        setReferenceEditorOpen(false);
        setReferenceMessage('Данные пациента изменились. Карточка обновлена — проверьте внутренний номер и повторите действие.');
        await load(true);
      } else if (failure.status === 403) {
        referenceIntent.current = null;
        setReferenceEditorOpen(false);
        setAliasEditorOpen(false);
        setWriteAvailable(false);
        setReferenceMessage('Изменение сейчас недоступно. Карточка остаётся доступна для просмотра.');
      } else if (failure.status === 404) {
        referenceIntent.current = null;
        aliasIntent.current = null;
        setReferenceEditorOpen(false);
        setAliasEditorOpen(false);
        valid.current = null;
        setDetail(null);
        setPhase('not-found');
      } else if (failure.status === 422) {
        setReferenceError('Не удалось сохранить внутренний номер. Проверьте значение и повторите попытку.');
      } else if (failure.status === 503 && failure.code === 'POLICY_TEMPORARILY_UNAVAILABLE') {
        setReferenceError('Не удалось проверить доступ к изменению. Попробуйте ещё раз.');
      } else {
        setReferenceError('Не удалось сохранить внутренний номер. Последние подтверждённые данные не изменены — попробуйте ещё раз.');
      }
    } finally {
      setReferencePending(false);
    }
  };

  const back = `/clinics/${encodeURIComponent(clinicId)}/locations/${encodeURIComponent(locationId)}/patients`;
  const patient = detail?.patient;
  const visible = patient && !['loading', 'not-found', 'denied', 'error', 'malformed', 'policy'].includes(phase);
  return <main id="main-content" className="min-h-screen bg-slate-50 px-4 py-6 sm:px-8 lg:px-12"><div className="mx-auto max-w-6xl">
    <Link href={back} className="inline-flex min-h-11 items-center rounded-xl px-2 text-sm font-semibold text-blue-800 hover:bg-blue-50">← Вернуться к пациентам</Link>
    <header className="mt-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-sm font-semibold text-blue-700">VetHelp · Административная карточка</p>
        <h1 className="mt-1 break-words text-3xl font-semibold tracking-tight text-slate-950">{patient?.pet.displayName ?? 'Карточка пациента'}</h1>
        {patient && <p className="mt-2 text-sm text-slate-600">{patient.pet.speciesLabel}</p>}</div>
      <button type="button" disabled={invalid} aria-disabled={refreshing || invalid}
        onClick={() => { if (!refreshing && !invalid) void load(true); }}
        className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60">
        {refreshing ? 'Обновляем…' : 'Обновить карточку'}
      </button>
    </div></header>
    <div className="mt-6" aria-live="polite">
      {phase === 'loading' && <section aria-label="Загрузка карточки пациента" role="status" className="grid gap-5 lg:grid-cols-2">
        {[0, 1, 2].map((item) => <div key={item} aria-hidden="true" className="h-48 animate-pulse rounded-2xl border border-slate-200 bg-white motion-reduce:animate-none" />)}
      </section>}
      {phase === 'not-found' && <Message headingRef={stateHeading} title="Карточка недоступна или больше не существует." text="Вернитесь к пациентам доступной локации." />}
      {phase === 'denied' && <Message headingRef={stateHeading} title="Нет доступа к карточке пациента" text="Вернитесь к пациентам доступной локации." />}
      {phase === 'policy' && <Message title="Карточка временно недоступна" text="Не удалось проверить актуальные правила доступа. Попробуйте позже." />}
      {phase === 'error' && <Message title="Не удалось загрузить карточку" text="Это техническая ошибка, а не отсутствие пациента." retry={() => void load()} />}
      {phase === 'malformed' && <Message title="Не удалось проверить данные карточки" text="Ответ сервиса имеет неподдерживаемый формат. Данные не показаны." retry={() => void load()} />}
      {phase === 'degraded' && <section role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
        <p className="font-semibold text-amber-950">Обновление проверить не удалось</p>
        <p className="mt-1 text-sm text-amber-900">Показаны последние подтверждённые данные; они не считаются новым ответом сервиса.</p>
      </section>}
      {visible && <div className="grid gap-5 lg:grid-cols-2">
        <section aria-labelledby="patient-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 id="patient-title" className="text-xl font-semibold text-slate-950">Пациент</h2><dl className="mt-5 grid gap-5 sm:grid-cols-2">
            <Fact label="Имя" value={patient.pet.displayName} /><Fact label="Вид" value={patient.pet.speciesLabel} />
            <Fact label="Порода" value={patient.pet.breed ?? 'Не указана'} /><Fact label="Пол" value={sex(patient.pet.sexCode)} />
            <Fact label="Дата рождения" value={date(patient.pet.birthDate)} /><Fact label="Владелец" value={patient.owner.displayName ?? 'Владелец не указан'} />
          </dl>
        </section>
        <section aria-labelledby="relationship-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 id="relationship-title" className="text-xl font-semibold text-slate-950">Административная связь</h2><dl className="mt-5 grid gap-5 sm:grid-cols-2">
            <Fact label="Первое обращение" value={instant(patient.relationship.firstSeenAt)} /><Fact label="Последнее обращение" value={instant(patient.relationship.lastSeenAt)} />
            <Fact label="Статус" value="Доступен для административной работы" /><Fact label="Локация" value="Текущая выбранная локация" />
          </dl>
        </section>
        <section aria-labelledby="local-alias-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0">
            <h2 id="local-alias-title" className="text-xl font-semibold text-slate-950">Имя в клинике</h2>
            <p className="mt-2 break-words text-base font-semibold text-slate-900">{patient.localProfile.alias ?? 'Не задано'}</p>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">Внутреннее имя для сотрудников этой клиники. Оно не изменяет официальное имя питомца и не показывается владельцу.</p>
            {patient.localProfile.updatedAt && <p className="mt-2 text-xs text-slate-500">Обновлено: {instant(patient.localProfile.updatedAt)}</p>}
          </div>
          {writeAvailable && phase === 'ready' && <button ref={aliasEditButton} type="button" onClick={openAliasEditor}
            disabled={referencePending} className="min-h-11 shrink-0 rounded-xl border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50 disabled:opacity-50">
            Изменить имя в клинике
          </button>}
          </div>
          {aliasMessage && <p role="status" className="mt-4 rounded-lg bg-slate-100 p-3 text-sm font-medium text-slate-800">{aliasMessage}</p>}
        </section>
        <section aria-labelledby="administrative-reference-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0">
            <h2 id="administrative-reference-title" className="text-xl font-semibold text-slate-950">Внутренний номер</h2>
            <p className="mt-2 break-words text-base font-semibold text-slate-900">{patient.localProfile.administrativeReference ?? 'Не задан'}</p>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">Используется сотрудниками этой локации для административного поиска и сопоставления.</p>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">Это не номер медицинской карты, не глобальный идентификатор пациента и не изменение данных владельца.</p>
          </div>
          {writeAvailable && phase === 'ready' && <button ref={referenceEditButton} type="button" onClick={openReferenceEditor}
            disabled={aliasPending} className="min-h-11 shrink-0 rounded-xl border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50 disabled:opacity-50">
            Изменить внутренний номер
          </button>}
          </div>
          {referenceMessage && <p role="status" className="mt-4 rounded-lg bg-slate-100 p-3 text-sm font-medium text-slate-800">{referenceMessage}</p>}
        </section>
        <section aria-labelledby="appointments-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2 sm:p-7">
          <h2 id="appointments-title" className="text-xl font-semibold text-slate-950">Записи</h2>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <AppointmentBlock title="Следующая запись" item={patient.appointments.next} clinicId={clinicId} locationId={locationId} />
            <AppointmentBlock title="Последняя запись" item={patient.appointments.last} clinicId={clinicId} locationId={locationId} />
          </div>
          <h3 className="mt-7 text-lg font-semibold text-slate-950">Недавние записи</h3>
          {patient.appointments.recent.length ? <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {patient.appointments.recent.map((item) => <Appointment key={item.appointmentId} item={item} clinicId={clinicId} locationId={locationId} />)}
          </ul> : <p className="mt-3 text-sm text-slate-600">Недавних записей нет.</p>}
        </section>
      </div>}
    </div>
    {aliasEditorOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={(event) => {
      if (event.target === event.currentTarget) closeAliasEditor();
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="alias-dialog-title"
        onKeyDown={(event) => { if (event.key === 'Escape' && !aliasPending) closeAliasEditor(); }}
        className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl sm:p-7">
        <h2 id="alias-dialog-title" className="text-xl font-semibold text-slate-950">Изменить имя в клинике</h2>
        <p id="alias-help" className="mt-2 text-sm text-slate-600">От 1 до 80 символов. Изменение действует только внутри текущей клиники, не меняет данные владельца и официальное имя питомца.</p>
        <label htmlFor="patient-local-alias" className="mt-5 block text-sm font-semibold text-slate-900">Имя в клинике</label>
        <textarea ref={aliasInput} id="patient-local-alias" value={aliasInputValue} disabled={aliasPending} rows={1}
          aria-invalid={Boolean(aliasError)} aria-describedby={`alias-help${aliasError ? ' alias-error' : ''}`}
          onChange={(event) => { setAliasInputValue(event.target.value); setAliasError(null); aliasIntent.current = null; }}
          className="mt-2 min-h-11 w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-slate-950 disabled:bg-slate-100" />
        {aliasError && <p id="alias-error" role="alert" aria-live="assertive" className="mt-2 text-sm font-semibold text-red-700">{aliasError}</p>}
        <p className="mt-3 min-h-5 text-sm text-slate-600" role="status" aria-live="polite">{aliasPending ? 'Сохраняем имя…' : ''}</p>
        <div className="mt-5 flex flex-wrap-reverse justify-between gap-3">
          <button type="button" disabled={aliasPending || referencePending || detail?.patient.localProfile.alias === null} onClick={() => void saveAlias(true)}
            aria-label="Очистить имя в клинике" className="min-h-11 rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-800 disabled:opacity-50">
            Очистить имя
          </button>
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={aliasPending} onClick={closeAliasEditor}
              className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50">Отмена</button>
            <button type="button" disabled={aliasPending || referencePending} onClick={() => void saveAlias()}
              className="min-h-11 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {aliasPending ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </div>
        </div>
      </section>
    </div>}
    {referenceEditorOpen && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4" onMouseDown={(event) => {
      if (event.target === event.currentTarget) closeReferenceEditor();
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="reference-dialog-title"
        onKeyDown={(event) => { if (event.key === 'Escape' && !referencePending) closeReferenceEditor(); }}
        className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl sm:p-7">
        <h2 id="reference-dialog-title" className="text-xl font-semibold text-slate-950">Изменить внутренний номер</h2>
        <p id="reference-help" className="mt-2 text-sm text-slate-600">До 40 символов: буквы, цифры, пробел, -, _, / и точка. Это не номер медицинской карты и не глобальный идентификатор пациента.</p>
        <label htmlFor="patient-administrative-reference" className="mt-5 block text-sm font-semibold text-slate-900">Внутренний номер</label>
        <input ref={referenceInput} id="patient-administrative-reference" value={referenceInputValue} disabled={referencePending}
          aria-invalid={Boolean(referenceError)} aria-describedby={`reference-help${referenceError ? ' reference-error' : ''}`}
          onChange={(event) => { setReferenceInputValue(event.target.value); setReferenceError(null); referenceIntent.current = null; }}
          className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-950 disabled:bg-slate-100" />
        {referenceError && <p id="reference-error" role="alert" aria-live="assertive" className="mt-2 text-sm font-semibold text-red-700">{referenceError}</p>}
        <p className="mt-3 min-h-5 text-sm text-slate-600" role="status" aria-live="polite">{referencePending ? 'Сохраняем внутренний номер…' : ''}</p>
        <div className="mt-5 flex flex-wrap-reverse justify-between gap-3">
          <button type="button" disabled={referencePending || aliasPending || detail?.patient.localProfile.administrativeReference === null}
            onClick={() => void saveReference(true)} aria-label="Очистить внутренний номер"
            className="min-h-11 rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-800 disabled:opacity-50">
            Очистить внутренний номер
          </button>
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={referencePending} onClick={closeReferenceEditor}
              className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50">Отмена</button>
            <button type="button" disabled={referencePending || aliasPending} onClick={() => void saveReference()}
              className="min-h-11 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {referencePending ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </div>
        </div>
      </section>
    </div>}
  </div></main>;
}
