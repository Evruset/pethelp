'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchPatientDetail, PatientDetailResponseError, type PatientAppointment, type PatientDetail } from '@/lib/api/clinic-patient-detail';

type Props = { clinicId: string; locationId: string; patientId: string; invalid?: boolean };
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

export function ClinicPatientDetailView({ clinicId, locationId, patientId, invalid = false }: Props) {
  const [detail, setDetail] = useState<PatientDetail | null>(null);
  const [phase, setPhase] = useState<Phase>(invalid ? 'not-found' : 'loading');
  const [refreshing, setRefreshing] = useState(false);
  const generation = useRef(0);
  const request = useRef<AbortController | null>(null);
  const valid = useRef<PatientDetail | null>(null);
  const stateHeading = useRef<HTMLHeadingElement>(null);

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
  </div></main>;
}
