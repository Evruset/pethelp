'use client';

import { EffectiveSessionProvider, useEffectiveSession } from '@/components/auth/EffectiveSessionProvider';
import type { TelemedVetQueue } from '@/lib/api/telemed-vet';
import { TelemedVetQueueClient } from './TelemedVetQueueClient';

function Gate({ initialQueue }: { initialQueue: TelemedVetQueue }) {
  const { loading, error, hasCapability, refresh } = useEffectiveSession();
  if (loading) return <main className="mx-auto min-h-screen max-w-6xl px-6 py-12" aria-busy="true" aria-live="polite">Загрузка доступа…</main>;
  if (error) return <main className="mx-auto min-h-screen max-w-3xl px-6 py-12"><section className="rounded-lg border border-amber-200 bg-white p-8" role="alert">Telemed workspace временно недоступен. <button type="button" onClick={() => void refresh()}>Повторить</button></section></main>;
  if (!hasCapability('telemed.vet.queue.read')) return <main className="mx-auto min-h-screen max-w-3xl px-6 py-12"><section className="rounded-lg border border-red-200 bg-white p-8"><p className="text-sm font-semibold text-red-700">403 Access Denied</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Нет доступа к очереди телемедицины</h1></section></main>;
  return <TelemedVetQueueClient initialQueue={initialQueue} />;
}

export function TelemedVetQueueCapabilityGate({ initialQueue }: { initialQueue: TelemedVetQueue }) {
  return <EffectiveSessionProvider><Gate initialQueue={initialQueue} /></EffectiveSessionProvider>;
}
