'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useEffectiveSession } from '@/components/auth/EffectiveSessionProvider';
import { parseVeterinarianVisit, parseVeterinarianVisits, type VeterinarianVisit } from '@/lib/api/veterinarian-visits';

type Props = { clinicId: string; locationId: string; holdId?: string };
type State = 'idle' | 'loading' | 'unavailable' | 'error' | 'ready';

export function VeterinarianVisitWorkspace({ clinicId, locationId, holdId }: Props) {
  const { loading: sessionLoading, error: sessionError, hasCapability, hasClinicScope, refresh } = useEffectiveSession();
  const [state, setState] = useState<State>('idle');
  const [visits, setVisits] = useState<VeterinarianVisit[]>([]);
  const [visit, setVisit] = useState<VeterinarianVisit | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const allowed = !sessionLoading && !sessionError && hasCapability('clinical.visit.workspace.read') && hasClinicScope(clinicId, locationId);
  const endpoint = `/api/clinic/${clinicId}/locations/${locationId}/vet/visits${holdId ? `/${holdId}` : ''}`;

  useEffect(() => {
    if (!allowed) { setState('idle'); return; }
    let active = true;
    setState('loading');
    void fetch(endpoint, { cache: 'no-store' }).then(async (response) => {
      const payload = await response.json().catch(() => null);
      if (!active) return;
      if (response.status === 401 || response.status === 403 || response.status === 404) { setState('unavailable'); return; }
      if (!response.ok) { setState('error'); return; }
      if (holdId) {
        const parsed = parseVeterinarianVisit(payload);
        if (!parsed) { setState('error'); return; }
        setVisit(parsed);
      } else {
        const parsed = parseVeterinarianVisits(payload);
        if (!parsed) { setState('error'); return; }
        setVisits(parsed);
      }
      setState('ready');
    }).catch(() => { if (active) setState('error'); });
    return () => { active = false; };
  }, [allowed, endpoint, holdId, reloadKey]);

  if (sessionLoading) return <SurfaceState title="Загрузка доступа…" busy />;
  if (sessionError) return <SurfaceState title="Раздел временно недоступен" retry={() => void refresh()} />;
  if (!allowed) return <SurfaceState title="Раздел недоступен" />;
  if (state === 'loading' || state === 'idle') return <SurfaceState title="Загрузка приёмов…" busy />;
  if (state === 'unavailable') return <SurfaceState title="Приёмы сейчас недоступны" />;
  if (state === 'error') return <SurfaceState title="Не удалось получить приёмы" retry={() => setReloadKey((value) => value + 1)} />;
  return holdId ? <VisitDetail visit={visit!} clinicId={clinicId} locationId={locationId} canComplete={hasCapability('clinical.visit.complete') && hasClinicScope(clinicId, locationId)} refresh={() => setReloadKey((value) => value + 1)} /> : <VisitList visits={visits} clinicId={clinicId} locationId={locationId} />;
}

function SurfaceState({ title, busy, retry }: { title: string; busy?: boolean; retry?: () => void }) {
  return <main className="min-h-screen px-4 py-6 sm:px-8" aria-live="polite" aria-busy={busy}><section className="mx-auto max-w-4xl rounded-lg border border-slate-200 bg-white p-6"><h1 className="text-2xl font-semibold text-slate-950">{title}</h1>{retry ? <button type="button" className="mt-4 rounded bg-slate-900 px-4 py-2 text-white" onClick={retry}>Повторить</button> : null}</section></main>;
}

function VisitList({ visits, clinicId, locationId }: { visits: VeterinarianVisit[]; clinicId: string; locationId: string }) {
  return <main className="min-h-screen px-4 py-6 sm:px-8"><section className="mx-auto max-w-4xl" aria-labelledby="vet-visits-title"><h1 id="vet-visits-title" className="text-2xl font-semibold text-slate-950">Приёмы врача</h1>{visits.length === 0 ? <p className="mt-4 rounded-lg border border-slate-200 bg-white p-5 text-slate-600">Нет доступных приёмов.</p> : <ul className="mt-4 space-y-3">{visits.map((item) => <li key={item.holdId} className="rounded-lg border border-slate-200 bg-white p-5"><p className="font-semibold text-slate-950">{item.petDisplayName} · {item.species}</p><p className="mt-1 text-sm text-slate-600">{format(item.scheduledStart)} — {format(item.scheduledEnd)} · {item.status}</p><Link className="mt-3 inline-block text-sm font-semibold text-blue-700 underline" href={`/clinics/${clinicId}/locations/${locationId}/vet/visits/${item.holdId}`} aria-label={`Открыть приём ${item.petDisplayName}`}>Открыть приём</Link></li>)}</ul>}</section></main>;
}

function VisitDetail({ visit, clinicId, locationId, canComplete, refresh }: { visit: VeterinarianVisit; clinicId: string; locationId: string; canComplete: boolean; refresh: () => void }) {
  const [summary, setSummary] = useState(''); const [error, setError] = useState(''); const [pending, setPending] = useState(false); const [completed, setCompleted] = useState(false); const summaryRef = useRef<HTMLTextAreaElement>(null);
  async function complete(event: React.FormEvent) { event.preventDefault(); if (pending || !canComplete || visit.status !== 'CONFIRMED') return; const length = summary.trim().length; if (length < 3 || length > 8000) { setError(length < 3 ? 'Заключение должно содержать не менее 3 символов.' : 'Заключение не должно превышать 8000 символов.'); summaryRef.current?.focus(); return; } setPending(true); setError(''); try { const response = await fetch(`/api/clinic/booking-holds/${visit.holdId}/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ summary }) }); if (response.ok || response.status === 409) { setCompleted(true); refresh(); return; } if (response.status === 400) { setError('Проверьте клиническое заключение.'); summaryRef.current?.focus(); return; } if (response.status === 401 || response.status === 403) { setError('Завершение приёма недоступно.'); summaryRef.current?.focus(); return; } setError('Не удалось завершить приём. Попробуйте ещё раз.'); summaryRef.current?.focus(); } catch { setError('Не удалось завершить приём. Попробуйте ещё раз.'); summaryRef.current?.focus(); } finally { setPending(false); } }
  const formVisible = canComplete && visit.status === 'CONFIRMED';
  const completionConfirmed = completed || visit.status === 'COMPLETED';
  return <main className="min-h-screen px-4 py-6 sm:px-8"><section className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-6" aria-labelledby="vet-visit-detail-title"><Link className="text-sm font-semibold text-blue-700 underline" href={`/clinics/${clinicId}/locations/${locationId}/vet/visits`}>К списку приёмов</Link><h1 id="vet-visit-detail-title" className="mt-4 text-2xl font-semibold text-slate-950">{visit.petDisplayName}</h1><dl className="mt-4 grid gap-3 text-slate-700"><div><dt className="text-sm text-slate-500">Вид</dt><dd>{visit.species}</dd></div><div><dt className="text-sm text-slate-500">Время</dt><dd>{format(visit.scheduledStart)} — {format(visit.scheduledEnd)}</dd></div><div><dt className="text-sm text-slate-500">Статус</dt><dd>{visit.status}</dd></div></dl>{formVisible ? <form className="mt-6 border-t pt-5" onSubmit={complete} aria-label="Завершение приёма"><label className="block text-sm font-semibold text-slate-800" htmlFor="clinical-summary">Клиническое заключение</label><textarea ref={summaryRef} id="clinical-summary" value={summary} onChange={(event) => setSummary(event.target.value)} className="mt-2 w-full rounded border border-slate-300 p-3" minLength={3} maxLength={8000} required disabled={pending} aria-describedby={error ? 'clinical-summary-error' : undefined} />{error ? <p id="clinical-summary-error" role="alert" className="mt-2 text-sm text-red-700">{error}</p> : null}<button type="submit" className="mt-3 rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-60" disabled={pending}>{pending ? 'Завершение…' : 'Завершить приём'}</button></form> : <p className="mt-6 text-sm text-slate-600" role="status" aria-live="polite">{completionConfirmed ? 'Приём завершён.' : 'Действие завершения недоступно для текущего статуса.'}</p>}</section></main>;
}

function format(value: string) { return new Date(value).toLocaleString('ru-RU'); }
