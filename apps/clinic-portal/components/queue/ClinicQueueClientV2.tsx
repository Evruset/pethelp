'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { HoldAuditTrail, ManualConfirmationQueue, ManualConfirmationQueueItem } from '@/lib/api/clinic-queue';
import { AlternativeSlotDrawer } from './AlternativeSlotDrawer';

type Props = { clinicId: string; locationId: string; initialQueue: ManualConfirmationQueue };
type RowState = 'idle' | 'confirming' | 'declining' | 'requestingNotes' | 'fenced';

const SLA_CRITICAL_MS = 180000;
const POLL_MS = 15000;
const SPECIES_LABELS: Record<string, string> = { cat: 'Кошка', dog: 'Собака' };

const dt = (value: string) => new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
const tm = (value: string) => new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
const species = (value: string) => SPECIES_LABELS[value.toLowerCase()] ?? value;
const auditAction = (value: string): string => ({
  'booking.hold.created': 'Заявка создана',
  'booking.confirmed': 'Подтверждена',
  'booking.declined': 'Отклонена',
  'booking.hold.released': 'Освобождена',
  'booking.hold.expired': 'Истекла',
  'booking.notes.requested': 'Запрошены уточнения',
}[value] ?? value);

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
  const [notesItem, setNotesItem] = useState<ManualConfirmationQueueItem | null>(null);
  const [declineItem, setDeclineItem] = useState<ManualConfirmationQueueItem | null>(null);
  const [auditItem, setAuditItem] = useState<ManualConfirmationQueueItem | null>(null);
  const [auditTrail, setAuditTrail] = useState<HoldAuditTrail | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const commandKeys = useRef(new Map<string, string>());

  const commandKey = (holdId: string, action: 'confirm' | 'decline' | 'requestNotes'): string => `${holdId}:${action}`;

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
    const mapKey = commandKey(holdId, 'confirm');
    const key = commandKeys.current.get(mapKey) ?? crypto.randomUUID();
    commandKeys.current.set(mapKey, key);
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
        commandKeys.current.delete(mapKey);
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
        commandKeys.current.delete(mapKey);
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

  const decline = useCallback(async (item: ManualConfirmationQueueItem) => {
    const holdId = item.holdId;
    if ((rowState[holdId] ?? 'idle') !== 'idle') return;
    setDeclineItem(null);

    const mapKey = commandKey(holdId, 'decline');
    const key = commandKeys.current.get(mapKey) ?? crypto.randomUUID();
    commandKeys.current.set(mapKey, key);
    setRowState((state) => ({ ...state, [holdId]: 'declining' }));
    setNotice(null);
    try {
      const response = await fetch(`/api/clinic/booking-holds/${holdId}/decline`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': key,
          'If-Match': String(item.version),
          'X-Correlation-ID': correlationId(),
        },
        body: JSON.stringify({ declineReason: 'Клиника отклонила заявку в очереди подтверждения' }),
      });
      const payload = await response.json().catch(() => null);
      const code = errorCode(payload);
      if (response.ok) {
        commandKeys.current.delete(mapKey);
        setRowState((state) => ({ ...state, [holdId]: 'idle' }));
        setNotice('Заявка отклонена, слот освобождён. Очередь обновлена.');
        await refresh(true);
        return;
      }
      if (response.status === 409 && code === 'QUEUE_FIFO_VIOLATION') {
        commandKeys.current.delete(mapKey);
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
      setNotice('Не удалось отклонить заявку.');
    } catch {
      setRowState((state) => ({ ...state, [holdId]: 'idle' }));
      setNotice('Нет связи с VetHelp. Отклонение не отправлено.');
    }
  }, [refresh, rowState]);

  const openAudit = useCallback(async (item: ManualConfirmationQueueItem) => {
    setAuditItem(item);
    setAuditTrail(null);
    setAuditError(null);
    setAuditLoading(true);
    try {
      const response = await fetch(`/api/clinic/${clinicId}/locations/${locationId}/booking-holds/${item.holdId}/audit-trail`, { cache: 'no-store' });
      if (response.status === 403) {
        window.location.assign('/forbidden');
        return;
      }
      const payload = await response.json().catch(() => null) as HoldAuditTrail | null;
      if (!response.ok || !payload) {
        setAuditError('Не удалось загрузить историю заявки.');
        return;
      }
      setAuditTrail(payload);
    } catch {
      setAuditError('Нет связи с VetHelp. История недоступна.');
    } finally {
      setAuditLoading(false);
    }
  }, [clinicId, locationId]);

  const requestNotes = useCallback(async (item: ManualConfirmationQueueItem, noteRequest: string) => {
    const holdId = item.holdId;
    if ((rowState[holdId] ?? 'idle') !== 'idle') return;
    const mapKey = commandKey(holdId, 'requestNotes');
    const key = commandKeys.current.get(mapKey) ?? crypto.randomUUID();
    commandKeys.current.set(mapKey, key);
    setRowState((state) => ({ ...state, [holdId]: 'requestingNotes' }));
    setNotice(null);
    try {
      const response = await fetch(`/api/clinic/booking-holds/${holdId}/request-notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': key,
          'If-Match': String(item.version),
          'X-Correlation-ID': correlationId(),
        },
        body: JSON.stringify({ noteRequest }),
      });
      const payload = await response.json().catch(() => null);
      const code = errorCode(payload);
      if (response.ok) {
        commandKeys.current.delete(mapKey);
        setRowState((state) => ({ ...state, [holdId]: 'idle' }));
        setNotesItem(null);
        setNotice('Запрос уточнений отправлен владельцу. Очередь обновлена.');
        await refresh(true);
        return;
      }
      if (response.status === 409 && code === 'QUEUE_FIFO_VIOLATION') {
        commandKeys.current.delete(mapKey);
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
      setNotice('Не удалось запросить уточнения.');
    } catch {
      setRowState((state) => ({ ...state, [holdId]: 'idle' }));
      setNotice('Нет связи с VetHelp. Запрос уточнений не отправлен.');
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
                  {queue.items.map((item, index) => <QueueRow key={item.holdId} item={item} position={index + 1} serverNowMs={serverNowMs} state={rowState[item.holdId] ?? 'idle'} canAct={firstActionableIndex === index} onConfirm={confirm} onDecline={setDeclineItem} onAlternative={setAlternativeItem} onNotes={setNotesItem} onAudit={openAudit} />)}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
      <AlternativeSlotDrawer locationId={locationId} item={alternativeItem} onClose={() => setAlternativeItem(null)} onProposed={async () => { setNotice('Альтернативное время отправлено владельцу.'); await refresh(true); }} />
      <RequestNotesDrawer item={notesItem} submitting={notesItem ? rowState[notesItem.holdId] === 'requestingNotes' : false} onClose={() => setNotesItem(null)} onSubmit={requestNotes} />
      <DeclineDialog item={declineItem} submitting={declineItem ? rowState[declineItem.holdId] === 'declining' : false} onClose={() => setDeclineItem(null)} onConfirm={decline} />
      <AuditTrailDrawer item={auditItem} trail={auditTrail} loading={auditLoading} error={auditError} onClose={() => { setAuditItem(null); setAuditTrail(null); setAuditError(null); }} />
    </main>
  );
}

function Empty() {
  return <div className="px-6 py-16 text-center"><p className="text-lg font-semibold text-slate-900">Нет заявок, ожидающих подтверждения</p><p className="mt-2 text-sm text-slate-600">Новые заявки появятся здесь в порядке поступления.</p></div>;
}

function QueueRow({ item, position, serverNowMs, state, canAct, onConfirm, onDecline, onAlternative, onNotes, onAudit }: { item: ManualConfirmationQueueItem; position: number; serverNowMs: number; state: RowState; canAct: boolean; onConfirm: (item: ManualConfirmationQueueItem) => void; onDecline: (item: ManualConfirmationQueueItem) => void; onAlternative: (item: ManualConfirmationQueueItem) => void; onNotes: (item: ManualConfirmationQueueItem) => void; onAudit: (item: ManualConfirmationQueueItem) => void }) {
  const remainingMs = Date.parse(item.confirmationSlaExpiresAt) - serverNowMs;
  const breached = remainingMs <= 0;
  const critical = !breached && remainingMs <= SLA_CRITICAL_MS;
  const blocked = breached || state === 'fenced' || !canAct;
  const actionLabel = state === 'confirming'
    ? 'Подтверждаем...'
    : state === 'declining'
      ? 'Отклоняем...'
      : state === 'requestingNotes'
        ? 'Запрашиваем...'
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
      <td className="px-4 py-4 align-top text-sm text-slate-700"><p>{item.service?.displayName ?? 'Услуга не указана'}</p>{item.latestAudit ? <p className="mt-2 text-xs text-slate-500">Последнее: {auditAction(item.latestAudit.action)} · {dt(item.latestAudit.occurredAt)}</p> : null}</td>
      <td className="px-4 py-4 align-top"><p className="text-sm font-medium text-slate-800">{dt(item.slot.startsAt)}</p><p className="mt-1 text-xs text-slate-600">{tm(item.slot.startsAt)}-{tm(item.slot.endsAt)}</p></td>
      <td className="px-4 py-4 align-top"><span className={`inline-flex rounded-full px-2.5 py-1 text-sm font-semibold ${(critical || breached) ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-700'}`} aria-live={critical || breached ? 'polite' : undefined}>{breached ? 'SLA истёк' : `Осталось ${clock(remainingMs)}`}</span>{(critical || breached) ? <p className="mt-2 text-xs font-medium text-red-800">{breached ? 'Заявка передана в автоматическую обработку.' : 'Срок подтверждения истекает.'}</p> : !canAct ? <p className="mt-2 text-xs text-slate-600">Сначала обработайте более раннюю заявку.</p> : null}</td>
      <td className="px-4 py-4 align-top"><div className="flex flex-col gap-2"><button type="button" disabled={blocked || state !== 'idle'} onClick={() => onConfirm(item)} className="w-full rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600">{actionLabel}</button><button type="button" disabled={blocked || state !== 'idle'} onClick={() => onAlternative(item)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">Другое время</button><button type="button" disabled={blocked || state !== 'idle'} onClick={() => onNotes(item)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">Уточнения</button><button type="button" disabled={blocked || state !== 'idle'} onClick={() => onDecline(item)} className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400">Отклонить</button><button type="button" onClick={() => onAudit(item)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">История</button></div></td>
    </tr>
  );
}

function RequestNotesDrawer({ item, submitting, onClose, onSubmit }: { item: ManualConfirmationQueueItem | null; submitting: boolean; onClose: () => void; onSubmit: (item: ManualConfirmationQueueItem, noteRequest: string) => void }) {
  const [noteRequest, setNoteRequest] = useState('');

  useEffect(() => {
    setNoteRequest('');
  }, [item?.holdId]);

  if (!item) return null;

  const normalized = noteRequest.trim();
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="notes-title">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-slate-950/40" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        <header className="border-b border-slate-200 px-6 py-5">
          <p className="text-sm font-semibold text-blue-700">VetHelp</p>
          <h2 id="notes-title" className="mt-1 text-2xl font-semibold text-slate-950">Запросить уточнения</h2>
          <p className="mt-2 text-sm text-slate-600">{item.pet.name} · {item.service?.displayName ?? 'Услуга не указана'}</p>
        </header>
        <section className="flex-1 px-6 py-4">
          <label htmlFor="note-request" className="text-sm font-semibold text-slate-900">Что нужно уточнить у владельца</label>
          <textarea
            id="note-request"
            value={noteRequest}
            onChange={(event) => setNoteRequest(event.target.value.slice(0, 1000))}
            rows={8}
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
            placeholder="Например: уточните, были ли анализы за последние 14 дней, и приложите фото назначения."
          />
          <p className="mt-2 text-xs text-slate-500">Запрос фиксируется в audit trail и отправляется через backend outbox.</p>
        </section>
        <footer className="flex gap-3 border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={onClose} disabled={submitting} className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">Отмена</button>
          <button type="button" disabled={normalized.length < 3 || submitting} onClick={() => onSubmit(item, normalized)} className="flex-1 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600">
            {submitting ? 'Отправляем...' : 'Запросить'}
          </button>
        </footer>
      </aside>
    </div>
  );
}

function DeclineDialog({ item, submitting, onClose, onConfirm }: { item: ManualConfirmationQueueItem | null; submitting: boolean; onClose: () => void; onConfirm: (item: ManualConfirmationQueueItem) => void }) {
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="decline-title">
      <button type="button" aria-label="Закрыть" className="absolute inset-0 bg-slate-950/40" onClick={onClose} disabled={submitting} />
      <section className="absolute left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-2xl">
        <header className="border-b border-slate-200 px-6 py-5">
          <p className="text-sm font-semibold text-red-700">VetHelp · booking queue</p>
          <h2 id="decline-title" className="mt-1 text-2xl font-semibold text-slate-950">Отклонить заявку</h2>
          <p className="mt-2 text-sm text-slate-600">{item.pet.name} · {item.service?.displayName ?? 'Услуга не указана'}</p>
        </header>
        <div className="px-6 py-5 text-sm text-slate-700">
          Слот будет освобождён, а владелец увидит актуальный статус заявки.
        </div>
        <footer className="flex gap-3 border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={onClose} disabled={submitting} className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">Отмена</button>
          <button type="button" onClick={() => onConfirm(item)} disabled={submitting} className="flex-1 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600">
            {submitting ? 'Отклоняем...' : 'Отклонить заявку'}
          </button>
        </footer>
      </section>
    </div>
  );
}

function AuditTrailDrawer({ item, trail, loading, error, onClose }: { item: ManualConfirmationQueueItem | null; trail: HoldAuditTrail | null; loading: boolean; error: string | null; onClose: () => void }) {
  if (!item) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="audit-title">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-slate-950/40" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        <header className="border-b border-slate-200 px-6 py-5">
          <p className="text-sm font-semibold text-blue-700">VetHelp audit trail</p>
          <h2 id="audit-title" className="mt-1 text-2xl font-semibold text-slate-950">История заявки</h2>
          <p className="mt-2 text-sm text-slate-600">{item.pet.name} · {dt(item.slot.startsAt)}</p>
        </header>
        <section className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}</div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</div>
          ) : !trail || trail.items.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">История пока пуста.</div>
          ) : (
            <ol className="space-y-3">
              {trail.items.map((event) => (
                <li key={event.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{auditAction(event.action)}</p>
                      <p className="mt-1 text-xs text-slate-500">{event.actorType}{event.actorId ? ` · ${event.actorId}` : ''}</p>
                    </div>
                    <time className="shrink-0 text-xs text-slate-500">{dt(event.occurredAt)}</time>
                  </div>
                  {event.correlationId ? <p className="mt-2 text-xs text-slate-500">Correlation: {event.correlationId}</p> : null}
                  <pre className="mt-3 max-h-32 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{JSON.stringify(event.payload, null, 2)}</pre>
                </li>
              ))}
            </ol>
          )}
        </section>
        <footer className="border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={onClose} className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Закрыть</button>
        </footer>
      </aside>
    </div>
  );
}
