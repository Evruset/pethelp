'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ManualConfirmationQueueItem } from '@/lib/api/clinic-queue';
import type { ClinicAvailableSlot, ClinicAvailableSlots } from '@/lib/api/clinic-available-slots';

type Props = {
  clinicId: string;
  locationId: string;
  request: ManualConfirmationQueueItem;
  correlationId: string;
  onClose: () => void;
  onSuccess: () => void;
  onNotice: (message: string) => void;
};

type LoadState = 'loading' | 'ready' | 'error';

function formatSlot(slot: ClinicAvailableSlot): string {
  const date = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const time = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `${date.format(new Date(slot.startsAt))} · ${time.format(new Date(slot.startsAt))}–${time.format(new Date(slot.endsAt))}`;
}

export function AlternativeSlotDrawer({
  clinicId,
  locationId,
  request,
  correlationId,
  onClose,
  onSuccess,
  onNotice,
}: Props) {
  const [state, setState] = useState<LoadState>('loading');
  const [slots, setSlots] = useState<ClinicAvailableSlot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      setState('loading');
      try {
        const response = await fetch(
          `/api/clinic/${clinicId}/locations/${locationId}/available-slots?excludeSlotId=${request.slot.id}`,
          { cache: 'no-store' },
        );
        if (response.status === 403) {
          window.location.assign('/forbidden');
          return;
        }
        const payload = await response.json().catch(() => null) as ClinicAvailableSlots | null;
        if (!response.ok || !payload || !active) {
          setState('error');
          return;
        }
        setSlots(payload.items);
        setSelectedSlotId(payload.items[0]?.id ?? null);
        setState('ready');
      } catch {
        if (active) setState('error');
      }
    })();
    return () => { active = false; };
  }, [clinicId, locationId, request.slot.id]);

  const selected = useMemo(
    () => slots.find((slot) => slot.id === selectedSlotId) ?? null,
    [selectedSlotId, slots],
  );

  const submit = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/clinic/booking-holds/${request.holdId}/alternative-slot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
          'X-Correlation-ID': correlationId,
        },
        body: JSON.stringify({ newSlotId: selected.id }),
      });
      const payload = await response.json().catch(() => null) as { code?: unknown } | null;
      const code = typeof payload?.code === 'string' ? payload.code : 'BACKEND_UNAVAILABLE';
      if (response.ok) {
        onNotice('Альтернативное время отправлено владельцу. Исходный slot остаётся защищён до решения.');
        onSuccess();
        return;
      }
      if (response.status === 409) {
        onNotice(code === 'SLOT_LOCKED_RETRY'
          ? 'Слот обновляется. Очередь будет перезагружена.'
          : 'Выбранное время уже недоступно. Получаем актуальные данные.');
        onSuccess();
        return;
      }
      if (response.status === 422) {
        onNotice('Заявка уже изменилась или срок подтверждения истёк. Очередь обновлена.');
        onSuccess();
        return;
      }
      onNotice('Не удалось создать предложение переноса. Повторите попытку.');
    } catch {
      onNotice('Нет связи с VetHelp. Предложение не отправлено.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35" role="dialog" aria-modal="true" aria-labelledby="alternative-title">
      <section className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <p className="text-sm font-semibold text-amber-700">Предложить перенос</p>
            <h2 id="alternative-title" className="mt-1 text-xl font-semibold text-slate-950">Выберите новое время</h2>
            <p className="mt-2 text-sm text-slate-600">Питомец: {request.pet.name}. Исходный slot будет удерживаться до решения владельца.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-lg text-slate-500 hover:bg-slate-100" aria-label="Закрыть">×</button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {state === 'loading' ? <DrawerSkeleton /> : null}
          {state === 'error' ? <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Не удалось получить доступные окна. Закройте drawer и повторите попытку.</p> : null}
          {state === 'ready' && slots.length === 0 ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Сейчас нет доступных окон для переноса.</p> : null}
          {state === 'ready' && slots.length > 0 ? (
            <fieldset className="space-y-3">
              <legend className="sr-only">Доступные окна</legend>
              {slots.map((slot) => (
                <label key={slot.id} className={`block cursor-pointer rounded-xl border p-4 ${selectedSlotId === slot.id ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                  <input type="radio" name="alternative-slot" className="sr-only" checked={selectedSlotId === slot.id} onChange={() => setSelectedSlotId(slot.id)} />
                  <span className="block text-sm font-semibold text-slate-950">{formatSlot(slot)}</span>
                  <span className="mt-1 block text-xs text-slate-600">{slot.serviceName ?? request.service?.displayName ?? 'Услуга'}</span>
                </label>
              ))}
            </fieldset>
          ) : null}
        </div>

        <footer className="border-t border-slate-200 p-5">
          <button
            type="button"
            disabled={!selected || submitting || state !== 'ready'}
            onClick={() => void submit()}
            className="w-full rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitting ? 'Отправляем…' : 'Предложить владельцу'}
          </button>
        </footer>
      </section>
    </div>
  );
}

function DrawerSkeleton() {
  return (
    <div className="space-y-3 animate-pulse" aria-label="Загрузка доступных окон">
      {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-20 rounded-xl bg-slate-100" />)}
    </div>
  );
}
