'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ManualConfirmationQueueItem } from '@/lib/api/clinic-queue';

type ClinicSlot = {
  id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  booked_count: number;
  held_count: number;
  remaining_capacity: string | number;
};

type Props = {
  locationId: string;
  item: ManualConfirmationQueueItem | null;
  onClose: () => void;
  onProposed: () => Promise<void>;
};

const formatDateTime = (value: string) => new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
}).format(new Date(value));
const formatDate = (value: string) => new Intl.DateTimeFormat('ru-RU', {
  weekday: 'short', day: '2-digit', month: '2-digit',
}).format(new Date(value));
const formatTime = (value: string) => new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit', minute: '2-digit',
}).format(new Date(value));
const dateKey = (value: string) => new Intl.DateTimeFormat('en-CA', {
  year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date(value));

const remaining = (slot: ClinicSlot) => Number(slot.remaining_capacity ?? slot.capacity - slot.booked_count - slot.held_count);

function correlationId(): string {
  const key = 'vethelp.clinic.correlation-id';
  const current = window.sessionStorage.getItem(key);
  if (current) return current;
  const next = crypto.randomUUID();
  window.sessionStorage.setItem(key, next);
  return next;
}

export function AlternativeSlotDrawer({ locationId, item, onClose, onProposed }: Props) {
  const [slots, setSlots] = useState<ClinicSlot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableSlots = useMemo(
    () => slots.filter((slot) => slot.id !== item?.slot.id && remaining(slot) > 0),
    [item?.slot.id, slots],
  );
  const slotGroups = useMemo(() => {
    const grouped = new Map<string, { key: string; label: string; slots: ClinicSlot[] }>();
    for (const slot of availableSlots) {
      const key = dateKey(slot.starts_at);
      const current = grouped.get(key);
      if (current) current.slots.push(slot);
      else grouped.set(key, { key, label: formatDate(slot.starts_at), slots: [slot] });
    }
    return [...grouped.values()].map((group) => ({
      ...group,
      slots: group.slots.sort((left, right) => Date.parse(left.starts_at) - Date.parse(right.starts_at)),
    }));
  }, [availableSlots]);
  const [activeDateKey, setActiveDateKey] = useState<string | null>(null);
  const selectedSlot = useMemo(
    () => availableSlots.find((slot) => slot.id === selectedSlotId) ?? null,
    [availableSlots, selectedSlotId],
  );
  const activeGroup = slotGroups.find((group) => group.key === activeDateKey) ?? slotGroups[0] ?? null;

  const loadSlots = useCallback(async (options: { preserveError?: boolean } = {}) => {
    if (!item) return;
    setLoading(true);
    if (!options.preserveError) setError(null);
    try {
      const url = new URL(`/api/clinic/locations/${locationId}/slots`, window.location.origin);
      url.searchParams.set('from', new Date().toISOString());
      url.searchParams.set('to', new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString());
      const response = await fetch(url, { cache: 'no-store' });
      if (response.status === 403) {
        window.location.assign('/forbidden');
        return;
      }
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(payload)) {
        setError('Не удалось загрузить доступные окна.');
        return;
      }
      setSlots(payload as ClinicSlot[]);
    } catch {
      setError('Нет связи с VetHelp.');
    } finally {
      setLoading(false);
    }
  }, [item, locationId]);

  useEffect(() => {
    if (item) void loadSlots();
  }, [item, loadSlots]);

  useEffect(() => {
    if (!item) {
      setSelectedSlotId(null);
      setActiveDateKey(null);
      return;
    }
    if (selectedSlot) {
      const selectedDateKey = dateKey(selectedSlot.starts_at);
      if (selectedDateKey !== activeDateKey) setActiveDateKey(selectedDateKey);
      return;
    }
    if (selectedSlotId && availableSlots.length > 0) setSelectedSlotId(null);
    if (!activeDateKey || !slotGroups.some((group) => group.key === activeDateKey)) {
      setActiveDateKey(slotGroups[0]?.key ?? null);
    }
  }, [activeDateKey, availableSlots.length, item, selectedSlot, selectedSlotId, slotGroups]);

  const submit = useCallback(async () => {
    if (!item || !selectedSlotId || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/clinic/booking-holds/${item.holdId}/alternative-slot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
          'If-Match': String(item.version),
          'X-Correlation-ID': correlationId(),
        },
        body: JSON.stringify({ newSlotId: selectedSlotId }),
      });
      const payload = await response.json().catch(() => null) as { code?: string } | null;
      if (response.ok) {
        await onProposed();
        onClose();
        return;
      }
      if (response.status === 409 && payload?.code === 'SLOT_LOCKED_RETRY') {
        setError('Слот обновляется. Загружаем актуальный список.');
        await loadSlots({ preserveError: true });
        return;
      }
      if (response.status === 409) {
        setError('Выбранное время уже недоступно.');
        await loadSlots({ preserveError: true });
        return;
      }
      if (response.status === 422) {
        setError('Заявка изменилась или истекла. Обновляем очередь.');
        await onProposed();
        return;
      }
      setError('Не удалось предложить другое время.');
    } catch {
      setError('Нет связи с VetHelp.');
    } finally {
      setSubmitting(false);
    }
  }, [item, loadSlots, onClose, onProposed, selectedSlotId, submitting]);

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="alternative-title">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-slate-950/40" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        <header className="border-b border-slate-200 px-6 py-5">
          <p className="text-sm font-semibold text-blue-700">VetHelp</p>
          <h2 id="alternative-title" className="mt-1 text-2xl font-semibold text-slate-950">Предложить другое время</h2>
          <p className="mt-2 text-sm text-slate-600">Исходная заявка сохраняется до решения владельца.</p>
        </header>
        <section className="border-b border-slate-200 px-6 py-4 text-sm text-slate-700">
          <p className="font-semibold text-slate-950">{item.pet.name}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Старое время</p>
              <p className="mt-1 font-medium text-slate-950">{formatDateTime(item.slot.startsAt)}</p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Новое время</p>
              <p className="mt-1 font-medium text-slate-950">{selectedSlot ? formatDateTime(selectedSlot.starts_at) : 'Не выбрано'}</p>
            </div>
          </div>
        </section>
        <section className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}</div>
          ) : availableSlots.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">Нет доступных окон.</div>
          ) : (
            <div>
              <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Дни с доступными окнами">
                {slotGroups.map((group) => (
                  <button
                    key={group.key}
                    type="button"
                    role="tab"
                    aria-selected={activeGroup?.key === group.key}
                    onClick={() => setActiveDateKey(group.key)}
                    className={`shrink-0 rounded-lg border px-3 py-2 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${activeGroup?.key === group.key ? 'border-blue-600 bg-blue-50 text-blue-900' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                  >
                    <span className="block font-semibold">{group.label}</span>
                    <span className="mt-0.5 block text-xs">{group.slots.length} окон</span>
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                {(activeGroup?.slots ?? []).map((slot) => (
                <button key={slot.id} type="button" data-testid={`alternative-slot-${slot.id}`} aria-pressed={selectedSlotId === slot.id} onClick={() => setSelectedSlotId(slot.id)} className={`w-full rounded-xl border px-4 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${selectedSlotId === slot.id ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                  <span className="block text-sm font-semibold text-slate-950">{formatTime(slot.starts_at)}-{formatTime(slot.ends_at)}</span>
                  <span className="mt-1 block text-xs text-slate-600">{formatDate(slot.starts_at)} · свободно мест: {remaining(slot)}</span>
                </button>
                ))}
              </div>
            </div>
          )}
        </section>
        {error ? <div className="mx-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</div> : null}
        <footer className="flex gap-3 border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Отмена</button>
          <button type="button" disabled={!selectedSlotId || submitting} onClick={() => void submit()} className="flex-1 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600">
            {submitting ? 'Отправляем...' : 'Предложить'}
          </button>
        </footer>
      </aside>
    </div>
  );
}
