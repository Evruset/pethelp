'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ManualConfirmationQueue, ManualConfirmationQueueItem } from '@/lib/api/clinic-queue';

type Connectivity = 'live' | 'reconnecting' | 'degraded';
type ActionState = 'idle' | 'confirming' | 'fenced';

type Props = {
  clinicId: string;
  locationId: string;
  initialQueue: ManualConfirmationQueue;
};

const SLA_AT_RISK_MS = 3 * 60 * 1000;
const POLL_INTERVAL_MS = 15 * 1000;

function formatClock(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatTimeRange(startsAt: string, endsAt: string): string {
  const format = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `${format.format(new Date(startsAt))}–${format.format(new Date(endsAt))}`;
}

function speciesLabel(value: string): string {
  const labels: Record<string, string> = {
    cat: 'Кошка',
    dog: 'Собака',
  };
  return labels[value.toLowerCase()] ?? value;
}

function getCorrelationId(): string {
  const key = 'vethelp.clinic.correlation-id';
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.sessionStorage.setItem(key, created);
  return created;
}

function isApiError(value: unknown): value is { code?: string } {
  return typeof value === 'object' && value !== null;
}

export function ClinicQueueClient({ clinicId, locationId, initialQueue }: Props) {
  const [queue, setQueue] = useState<ManualConfirmationQueue>(initialQueue);
  const [offsetMs, setOffsetMs] = useState(() => Date.parse(initialQueue.serverNow) - Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [connectivity, setConnectivity] = useState<Connectivity>('live');
  const [notice, setNotice] = useState<string | null>(null);
  const [actionState, setActionState] = useState<Record<string, ActionState>>({});
  const commandKeys = useRef(new Map<string, string>());

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setConnectivity('reconnecting');
    try {
      const response = await fetch(
        `/api/clinic/${clinicId}/locations/${locationId}/booking-queue`,
        { cache: 'no-store' },
      );
      if (response.status === 403) {
        window.location.assign('/forbidden');
        return;
      }
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok || !payload) {
        setConnectivity('degraded');
        if (!quiet) setNotice('Не удалось обновить очередь. Повторите попытку.');
        return;
      }
      const nextQueue = payload as ManualConfirmationQueue;
      setQueue(nextQueue);
      setOffsetMs(Date.parse(nextQueue.serverNow) - Date.now());
      setConnectivity('live');
      if (!quiet) setNotice(null);
    } catch {
      setConnectivity('degraded');
      if (!quiet) setNotice('Нет связи с VetHelp. Показаны последние полученные данные.');
    }
  }, [clinicId, locationId]);

  useEffect(() => {
    const ticker = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(ticker);
  }, []);

  useEffect(() => {
    const poller = window.setInterval(() => void refresh(true), POLL_INTERVAL_MS);
    return () => window.clearInterval(poller);
  }, [refresh]);

  const positionByHoldId = useMemo(
    () => new Map(queue.items.map((item, index) => [item.holdId, index + 1])),
    [queue.items],
  );

  const confirmHold = useCallback(async (item: ManualConfirmationQueueItem) => {
    const holdId = item.holdId;
    const current = actionState[holdId] ?? 'idle';
    if (current !== 'idle') return;

    const idempotencyKey = commandKeys.current.get(holdId) ?? crypto.randomUUID();
    commandKeys.current.set(holdId, idempotencyKey);
    setActionState((state) => ({ ...state, [holdId]: 'confirming' }));
    setNotice(null);

    try {
      const response = await fetch(`/api/clinic/booking-holds/${holdId}/confirm`, {
        method: 'POST',
        headers: {
          'Idempotency-Key': idempotencyKey,
          'If-Match': String(item.version),
          'X-Correlation-ID': getCorrelationId(),
        },
      });
      const payload: unknown = await response.json().catch(() => null);
      const code = isApiError(payload) && typeof payload.code === 'string' ? payload.code : 'BACKEND_UNAVAILABLE';

      if (response.ok) {
        commandKeys.current.delete(holdId);
        setActionState((state) => ({ ...state, [holdId]: 'idle' }));
        setNotice('Запись подтверждена. Очередь обновлена.');
        await refresh(true);
        return;
      }

      if (response.status === 409 && code === 'SLOT_LOCKED_RETRY') {
        setActionState((state) => ({ ...state, [holdId]: 'idle' }));
        setNotice('Заявка обновляется. Получаем актуальное состояние очереди.');
        await refresh(true);
        return;
      }

      if (response.status === 422 || response.status === 409 || response.status === 423) {
        setActionState((state) => ({ ...state, [holdId]: 'fenced' }));
        setNotice('Заявка уже изменилась или срок подтверждения истёк. Очередь обновлена.');
        await refresh(true);
        return;
      }

      setActionState((state) => ({ ...state, [holdId]: 'idle' }));
      setNotice('Не удалось подтвердить запись. Повторите попытку.');
    } catch {
      setActionState((state) => ({ ...state, [holdId]: 'idle' }));
      setNotice('Нет связи с VetHelp. Подтверждение не отправлено.');
    }
  }, [actionState, refresh]);

  return (
    <main className="min-h-screen px-4 py-6 sm:px-8 lg:px-12">
      <section className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-700">VetHelp · Локация клиники</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Очередь подтверждения</h1>
            <p className="mt-2 text-sm text-slate-600">
              Заявки показаны в строгом порядке поступления. Подтверждайте их последовательно.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={[
                'rounded-full px-3 py-1 text-xs font-semibold',
                connectivity === 'live' && 'bg-emerald-50 text-emerald-700',
                connectivity === 'reconnecting' && 'bg-amber-50 text-amber-800',
                connectivity === 'degraded' && 'bg-red-50 text-red-700',
              ].filter(Boolean).join(' ')}
              aria-live="polite"
            >
              {connectivity === 'live' ? 'Данные синхронизированы' : connectivity === 'reconnecting' ? 'Обновляем очередь' : 'Нет соединения'}
            </span>
            <button
              type="button"
              onClick={() => void refresh(false)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
            >
              Обновить
            </button>
          </div>
        </header>

        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          SLA отсчитывается от серверного времени VetHelp. Красная строка требует немедленного действия; после истечения срока действия блокируются на backend.
        </div>

        {notice ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700" role="status">
            {notice}
          </div>
        ) : null}

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {queue.items.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-lg font-semibold text-slate-900">Нет заявок, ожидающих подтверждения</p>
              <p className="mt-2 text-sm text-slate-600">Новые заявки появятся здесь в порядке поступления.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed border-collapse text-left">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="w-16 px-4 py-3">№</th>
                    <th className="w-40 px-4 py-3">Поступила</th>
                    <th className="w-48 px-4 py-3">Питомец</th>
                    <th className="w-52 px-4 py-3">Услуга</th>
                    <th className="w-44 px-4 py-3">Визит</th>
                    <th className="w-44 px-4 py-3">SLA</th>
                    <th className="w-36 px-4 py-3">Действие</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.items.map((item) => (
                    <QueueRow
                      key={item.holdId}
                      item={item}
                      position={positionByHoldId.get(item.holdId) ?? 0}
                      serverNowMs={now + offsetMs}
                      actionState={actionState[item.holdId] ?? 'idle'}
                      onConfirm={confirmHold}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function QueueRow({
  item,
  position,
  serverNowMs,
  actionState,
  onConfirm,
}: {
  item: ManualConfirmationQueueItem;
  position: number;
  serverNowMs: number;
  actionState: ActionState;
  onConfirm: (item: ManualConfirmationQueueItem) => void;
}) {
  const remainingMs = Date.parse(item.confirmationSlaExpiresAt) - serverNowMs;
  const breached = remainingMs <= 0;
  const critical = !breached && remainingMs <= SLA_AT_RISK_MS;
  const blocked = breached || actionState === 'fenced';

  const rowClass = breached
    ? 'bg-red-50 text-red-950'
    : critical
      ? 'bg-red-50/70 text-slate-950 motion-safe:animate-pulse'
      : 'bg-white text-slate-900';

  return (
    <tr className={`border-t border-slate-200 ${rowClass}`}>
      <td className="px-4 py-4 align-top text-sm font-semibold">{position}</td>
      <td className="px-4 py-4 align-top text-sm text-slate-700">{formatDateTime(item.manualConfirmPendingAt)}</td>
      <td className="px-4 py-4 align-top">
        <p className="text-sm font-semibold">{item.pet.name}</p>
        <p className="mt-1 text-xs text-slate-600">{speciesLabel(item.pet.species)}</p>
      </td>
      <td className="px-4 py-4 align-top text-sm text-slate-700">{item.service?.displayName ?? 'Услуга не указана'}</td>
      <td className="px-4 py-4 align-top">
        <p className="text-sm font-medium text-slate-800">{formatDateTime(item.slot.startsAt)}</p>
        <p className="mt-1 text-xs text-slate-600">{formatTimeRange(item.slot.startsAt, item.slot.endsAt)}</p>
      </td>
      <td className="px-4 py-4 align-top">
        <p
          className={[
            'inline-flex items-center rounded-full px-2.5 py-1 text-sm font-semibold',
            breached && 'bg-red-100 text-red-800',
            critical && 'bg-red-100 text-red-800',
            !critical && !breached && 'bg-slate-100 text-slate-700',
          ].filter(Boolean).join(' ')}
          aria-live={critical || breached ? 'polite' : undefined}
        >
          {breached ? 'SLA истёк' : `Осталось ${formatClock(remainingMs)}`}
        </p>
        {(critical || breached) ? (
          <p className="mt-2 text-xs font-medium text-red-800">
            {breached ? 'Заявка передана в автоматическую обработку.' : 'Срок подтверждения истекает.'}
          </p>
        ) : null}
      </td>
      <td className="px-4 py-4 align-top">
        <button
          type="button"
          disabled={blocked || actionState === 'confirming'}
          onClick={() => onConfirm(item)}
          className="w-full rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
        >
          {actionState === 'confirming' ? 'Подтверждаем…' : blocked ? 'Недоступно' : 'Подтвердить'}
        </button>
      </td>
    </tr>
  );
}
