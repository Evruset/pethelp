'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ManualConfirmationQueue, ManualConfirmationQueueItem } from '@/lib/api/clinic-queue';
import { AlternativeSlotDrawer } from './AlternativeSlotDrawer';

type Props = { clinicId: string; locationId: string; initialQueue: ManualConfirmationQueue };
type RowState = 'idle' | 'confirming' | 'fenced';

const SLA_CRITICAL_MS = 180000;
const POLL_MS = 15000;
const SPECIES_LABELS: Record<string, string> = { cat: 'Кошка', dog: 'Собака' };

const dt = (value: string) => new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
const tm = (value: string) => new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
const species = (value: string) => SPECIES_LABELS[value.toLowerCase()] ?? value;

function clock(ms: number): string {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(sec / 60).toString().padStart(2, '0')}:${(sec % 60).toString().padStart(2, '0')}`;
}

function correlationId(): string {
  const key = 'vethelp.clinic.correlation-id';
  const current = window.sessionStorage.getItem(key);
  if (current) return current;
  const next = crypto.randomUUID();
  window.sessionStorage.setItem(key, next);
  return next;
}

function errorCode(payload: unknown): string {
  return typeof payload === 'object' && payload !== null && 'code' in payload && typeof payload.code === 'string'
    ? payload.code
    : 'BACKEND_UNAVAILABLE';
}

export function ClinicQueueClientV2({ clinicId, locationId, initialQueue }: Props) {
  const [queue, setQueue] = useState(initialQueue);
  const [offsetMs, setOffsetMs] = useState(() => Date.parse(initialQueue.serverNow) - Date.now());
  const [now, setNow] = useState(Date.now());
  const [notice, setNotice] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const [alternativeItem, setAlternativeItem] = useState<ManualConfirmationQueueItem | null>(null);
  const commandKeys = useRef(new Map<string, string>());

  const refresh = useCallback(async (quiet = false) => {
    try {
      const response = await fetch(`/api/clinic/${clinicId}/locations/${locationId}/booking-queue`, { cache: 'no-store' });
      if (response.status === 403) {
        window.location.assign('/forbidden');
        return;
      }
      const payload = await response.json().catch(() => null) as ManualConfirmationQueue | null;
      if (!response.ok || !payload) throw new Error('queue');
      setQueue(payload);
      setOffsetMs(Date.parse(payload.serverNow) - Date.now());
      setOnline(true);
      if (!quiet) setNotice(null);
    } catch {
      setOnline(false);
      if (!quiet) setNotice('Нет связи с VetHelp. Показаны последние полученные данные.');
    }
  }, [clinicId, locationId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const poller = window.setInterval(() => void refresh(true), POLL_MS);
    return () => window.clearInterval(poller);
  }, [refresh]);

  const confirm = useCallback(async (item: ManualConfirmationQueueItem) => {
    const holdId = item.holdId;
    if ((rowState[holdId] ?? 'idle') !== 'idle') return;
    const key = commandKeys.current.get(holdId) ?? crypto.randomUUID();
    commandKeys.current.set(holdId, key);
    setRowState((state) => ({ ...state, [holdId]: 'confirming' }));
    setNotice(null);
    try {
      const response = await fetch(`/api/clinic/booking-holds/${holdId}/confirm`, {
        method: 'POST',
        headers: { 'Idempotency-Key': key, 'If-Match': String(item.version), 'X-Correlation-ID': correlationId() },
      });
      const payload = await response.json().catch(() => null);
      const code = errorCode(payload);
      if (response.ok) {
        commandKeys.current.delete(holdId);
        setRowState((state) => ({ ...state, [holdId]: 'idle' }));
        setNotice('Запись подтверждена. Очередь обновлена.');
        await refresh(true);
        return;
      }
      if (response.status === 409 && code === 'SLOT_LOCKED_RETRY') {
        setRowState((state) => ({ ...state, [holdId]: 'idle' }));
        setNotice('Обновляем состояние заявки.');
        await refresh(true);
        return;
      }
      if (response.status === 409 && code === 'QUEUE_FIFO_VIOLATION') {
        commandKeys.current.delete(holdId);
        setRowState((state) => ({ ...state, [holdId]: 'idle' }));
        setNotice('Сначала обработайте более раннюю заявку. Очередь обновлена.');
        await refresh(true);
        return;
      }
      if ([409, 422, 423].includes(response.status)) {
        setRowState((state) => ({ ...state, [holdId]: 'fenced' }));
        setNotice('Заявка изменилась или срок действия истёк. Очередь обновлена.');
        await refresh(true);
        return;
      }
      setRowState((state) => ({ ...state, [holdId]: 'idle' }));
      setNotice('Не удалось подтвердить запись.');
    } catch {
      setRowState((state) => ({ ...state, [holdId]: 'idle' }));
      setNotice('Нет связи с VetHelp. Подтверждение не отправлено.');
    }
  }, [refresh, rowState]);

  const serverNowMs = now + offsetMs;
  const firstActionableIndex = queue.items.findIndex((item) => Date.parse(item.confirmationSlaExpiresAt) > serverNowMs);

  return (
    <main className="min-h-screen px-4 py-6 sm:px-8 lg:px-12">
      <section className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-700">VetHelp</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Очередь подтверждения</h1>
            <p className="mt-2 text-sm text-slate-600">FIFO порядок задаёт backend. Таймеры основаны на serverNow.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${online ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`} aria-live="polite">
              {online ? 'Синхронизировано' : 'Нет соединения'}
            </span>
            <button type="button" onClick={() => void refresh(false)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Обновить</button>
          </div>
        </header>

        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          При предложении альтернативы исходный и новый слот защищаются backend до решения владельца.
        </div>
        {notice ? <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700" role="status">{notice}</div> : null}

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {queue.items.length === 0 ? <Empty /> : (
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed border-collapse text-left">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="w-16 px-4 py-3">№</th><th className="w-40 px-4 py-3">Поступила</th><th className="w-48 px-4 py-3">Питомец</th><th className="w-52 px-4 py-3">Услуга</th><th className="w-44 px-4 py-3">Визит</th><th className="w-44 px-4 py-3">SLA</th><th className="w-56 px-4 py-3">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.items.map((item, index) => <QueueRow key={item.holdId} item={item} position={index + 1} serverNowMs={serverNowMs} state={rowState[item.holdId] ?? 'idle'} canAct={firstActionableIndex === index} onConfirm={confirm} onAlternative={setAlternativeItem} />)}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
      <AlternativeSlotDrawer locationId={locationId} item={alternativeItem} onClose={() => setAlternativeItem(null)} onProposed={async () => { setNotice('Альтернативное время отправлено владельцу.'); await refresh(true); }} />
    </main>
  );
}

function Empty() {
  return <div className="px-6 py-16 text-center"><p className="text-lg font-semibold text-slate-900">Нет заявок, ожидающих подтверждения</p><p className="mt-2 text-sm text-slate-600">Новые заявки появятся здесь в порядке поступления.</p></div>;
}

function QueueRow({ item, position, serverNowMs, state, canAct, onConfirm, onAlternative }: { item: ManualConfirmationQueueItem; position: number; serverNowMs: number; state: RowState; canAct: boolean; onConfirm: (item: ManualConfirmationQueueItem) => void; onAlternative: (item: ManualConfirmationQueueItem) => void }) {
  const remainingMs = Date.parse(item.confirmationSlaExpiresAt) - serverNowMs;
  const breached = remainingMs <= 0;
  const critical = !breached && remainingMs <= SLA_CRITICAL_MS;
  const blocked = breached || state === 'fenced' || !canAct;
  const actionLabel = state === 'confirming'
    ? 'Подтверждаем...'
    : breached || state === 'fenced'
      ? 'Недоступно'
      : !canAct
        ? 'Ожидает очередь'
        : 'Подтвердить';
  return (
    <tr className={`border-t border-slate-200 ${breached ? 'bg-red-50 text-red-950' : critical ? 'bg-red-50/70 text-slate-950 motion-safe:animate-pulse' : 'bg-white text-slate-900'}`}>
      <td className="px-4 py-4 align-top text-sm font-semibold">{position}</td>
      <td className="px-4 py-4 align-top text-sm text-slate-700">{dt(item.manualConfirmPendingAt)}</td>
      <td className="px-4 py-4 align-top"><p className="text-sm font-semibold">{item.pet.name}</p><p className="mt-1 text-xs text-slate-600">{species(item.pet.species)}</p></td>
      <td className="px-4 py-4 align-top text-sm text-slate-700">{item.service?.displayName ?? 'Услуга не указана'}</td>
      <td className="px-4 py-4 align-top"><p className="text-sm font-medium text-slate-800">{dt(item.slot.startsAt)}</p><p className="mt-1 text-xs text-slate-600">{tm(item.slot.startsAt)}-{tm(item.slot.endsAt)}</p></td>
      <td className="px-4 py-4 align-top"><span className={`inline-flex rounded-full px-2.5 py-1 text-sm font-semibold ${(critical || breached) ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-700'}`} aria-live={critical || breached ? 'polite' : undefined}>{breached ? 'SLA истёк' : `Осталось ${clock(remainingMs)}`}</span>{(critical || breached) ? <p className="mt-2 text-xs font-medium text-red-800">{breached ? 'Заявка передана в автоматическую обработку.' : 'Срок подтверждения истекает.'}</p> : !canAct ? <p className="mt-2 text-xs text-slate-600">Сначала обработайте более раннюю заявку.</p> : null}</td>
      <td className="px-4 py-4 align-top"><div className="flex flex-col gap-2"><button type="button" disabled={blocked || state === 'confirming'} onClick={() => onConfirm(item)} className="w-full rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600">{actionLabel}</button><button type="button" disabled={blocked || state === 'confirming'} onClick={() => onAlternative(item)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">Другое время</button></div></td>
    </tr>
  );
}
