'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ClinicAppointmentsResponseError,
  getClinicAppointmentDetail,
  type ClinicAppointmentDetail as Detail,
} from '@/lib/api/clinic-appointments';

type Props = { clinicId: string; locationId: string; appointmentId: string };
type Phase = 'loading' | 'ready' | 'not-found' | 'error' | 'degraded';

const STATUS: Record<Detail['appointment']['statusCode'], { label: string; className: string }> = {
  SCHEDULED: { label: 'Запланирована', className: 'border-blue-200 bg-blue-50 text-blue-800' },
  COMPLETED: { label: 'Завершена', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  NO_SHOW: { label: 'Неявка', className: 'border-amber-300 bg-amber-50 text-amber-950' },
  CANCELLED: { label: 'Отменена', className: 'border-slate-300 bg-slate-100 text-slate-700' },
  UNKNOWN: { label: 'Статус уточняется', className: 'border-violet-300 bg-violet-50 text-violet-900' },
};

const date = (value: string) => new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric', month: 'long', year: 'numeric',
}).format(new Date(value));
const time = (value: string) => new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit', minute: '2-digit',
}).format(new Date(value));

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm text-slate-800">{value}</dd></div>;
}

export function ClinicAppointmentDetail({ clinicId, locationId, appointmentId }: Props) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [refreshKey, setRefreshKey] = useState(0);
  const generation = useRef(0);
  const request = useRef<AbortController | null>(null);
  const detailRef = useRef<Detail | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  const load = useCallback(async () => {
    const current = ++generation.current;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    if (!detailRef.current) setPhase('loading');
    try {
      const next = await getClinicAppointmentDetail({ clinicId, locationId, appointmentId, signal: controller.signal });
      if (current !== generation.current || controller.signal.aborted) return;
      detailRef.current = next;
      setDetail(next);
      setPhase('ready');
    } catch (error) {
      if (current !== generation.current || controller.signal.aborted) return;
      const notFound = error instanceof ClinicAppointmentsResponseError && (error.status === 403 || error.status === 404);
      setPhase(detailRef.current ? 'degraded' : notFound ? 'not-found' : 'error');
    } finally {
      if (request.current === controller) request.current = null;
    }
  }, [appointmentId, clinicId, locationId]);

  useEffect(() => {
    void load();
    return () => {
      generation.current += 1;
      request.current?.abort();
    };
  }, [load, refreshKey]);

  useEffect(() => {
    detailRef.current = null;
    setDetail(null);
    setPhase('loading');
  }, [appointmentId, clinicId, locationId]);

  useEffect(() => { heading.current?.focus(); }, [appointmentId, clinicId, locationId]);

  const refresh = () => {
    generation.current += 1;
    request.current?.abort();
    setRefreshKey((value) => value + 1);
  };
  const back = `/clinics/${encodeURIComponent(clinicId)}/locations/${encodeURIComponent(locationId)}/appointments`;
  const status = detail ? STATUS[detail.appointment.statusCode] : null;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <Link href={back} className="inline-flex min-h-11 items-center rounded-xl px-2 text-sm font-semibold text-blue-800 hover:bg-blue-50">← Вернуться к записям</Link>
        <header className="mt-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-blue-700">VetHelp · Клиника</p>
              <h1 ref={heading} tabIndex={-1} className="mt-1 text-3xl font-semibold tracking-tight text-slate-950 outline-none">Карточка записи</h1>
              {detail && <p className="mt-2 text-sm text-slate-600">{date(detail.schedule.startsAt)} · {time(detail.schedule.startsAt)}–{time(detail.schedule.endsAt)}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {status && <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${status.className}`}>{status.label}</span>}
              <button type="button" onClick={refresh} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">Обновить запись</button>
            </div>
          </div>
        </header>

        <div className="mt-6" aria-live="polite">
          {phase === 'loading' && <section role="status" className="rounded-2xl border border-slate-200 bg-white p-8"><h2 className="text-xl font-semibold text-slate-950">Загружаем запись…</h2></section>}
          {phase === 'not-found' && <section role="alert" className="rounded-2xl border border-amber-300 bg-white p-8"><h2 className="text-xl font-semibold text-slate-950">Запись недоступна или не найдена</h2><p className="mt-2 text-sm text-slate-600">Проверьте доступную локацию или вернитесь в реестр.</p></section>}
          {phase === 'error' && <section role="alert" className="rounded-2xl border border-red-200 bg-white p-8"><h2 className="text-xl font-semibold text-slate-950">Не удалось загрузить запись</h2><p className="mt-2 text-sm text-slate-600">Это техническая ошибка, а не отсутствие записи.</p><button type="button" onClick={refresh} className="mt-5 min-h-11 rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white">Повторить</button></section>}
          {phase === 'degraded' && <section role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4"><p className="font-semibold text-amber-950">Не удалось обновить запись</p><p className="mt-1 text-sm text-amber-900">Показаны последние подтверждённые данные.</p></section>}
          {detail && phase !== 'loading' && phase !== 'not-found' && phase !== 'error' && (
            <div className="grid gap-5 lg:grid-cols-2">
              <section aria-labelledby="schedule-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                <h2 id="schedule-title" className="text-xl font-semibold text-slate-950">Расписание</h2>
                <dl className="mt-5 grid gap-5 sm:grid-cols-2">
                  <Fact label="Дата" value={date(detail.schedule.startsAt)} />
                  <Fact label="Время" value={`${time(detail.schedule.startsAt)}–${time(detail.schedule.endsAt)}`} />
                  <Fact label="Часовой пояс" value={detail.schedule.timezone} />
                  <Fact label="Источник" value={detail.schedule.sourceLabel} />
                  <Fact label="Услуга" value={detail.service?.displayName ?? 'Не указана'} />
                  <Fact label="Ветеринар" value={detail.veterinarian?.displayName ?? 'Не указан'} />
                  <Fact label="Кабинет или ресурс" value={detail.resource?.displayName ?? 'Не указан'} />
                  <Fact label="Создана" value={`${date(detail.appointment.createdAt)} · ${time(detail.appointment.createdAt)}`} />
                </dl>
              </section>
              <section aria-labelledby="participants-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                <h2 id="participants-title" className="text-xl font-semibold text-slate-950">Питомец и владелец</h2>
                <dl className="mt-5 grid gap-5 sm:grid-cols-2">
                  <Fact label="Питомец" value={detail.pet.displayName} />
                  <Fact label="Вид" value={detail.pet.speciesLabel} />
                  <Fact label="Владелец" value={detail.owner?.displayName ?? 'Владелец не указан'} />
                  <Fact label="Статус" value={status?.label ?? 'Статус уточняется'} />
                </dl>
              </section>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
