'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { EffectiveSessionProvider, useEffectiveSession } from '@/components/auth/EffectiveSessionProvider';

const navItems = [
  { label: 'Очередь', href: 'queue', ariaLabel: 'Открыть очередь записей', capability: 'booking.queue.read' },
  { label: 'Расписание', href: 'schedule', ariaLabel: 'Открыть расписание', capability: 'schedule.read' },
  { label: 'Качество', href: 'quality', ariaLabel: 'Открыть панель качества', capability: 'quality.read' },
  { label: 'Приёмы врача', href: 'vet/visits', ariaLabel: 'Открыть приёмы врача', capability: 'clinical.visit.workspace.read' },
] as const;

function Navigation({ clinicId, locationId }: { clinicId: string; locationId: string }) {
  const { loading, error, hasCapability, hasClinicScope, refresh } = useEffectiveSession();
  const basePath = `/clinics/${clinicId}/locations/${locationId}`;
  const items = navItems.filter((item) => !('capability' in item) || (!loading && !error && hasCapability(item.capability) && hasClinicScope(clinicId, locationId)));
  return <>
    {loading ? <p className="vh-clinic-nav-item" aria-live="polite" aria-busy="true">Загрузка доступа…</p> : null}
    {error ? <div role="alert" className="vh-clinic-nav-item">Доступ к capability-разделам недоступен. <button type="button" onClick={() => void refresh()}>Повторить</button></div> : null}
    {items.map((item) => <Link key={item.href} className="vh-clinic-nav-item" href={`${basePath}/${item.href}`} aria-label={item.ariaLabel}>{item.label}</Link>)}
  </>;
}

export function ClinicPortalShellV51Client({ clinicId, locationId, children }: { clinicId: string; locationId: string; children: ReactNode }) {
  return <EffectiveSessionProvider><div className="vh-clinic-shell" data-testid="clinic-portal-shell-v51">
    <a className="vh-v51-skip-link" href="#clinic-v51-content">Перейти к содержимому</a>
    <aside className="vh-clinic-sidebar" aria-label="Навигация портала клиники"><div className="vh-clinic-brand" aria-label="VetHelp Clinic Portal"><span className="vh-clinic-brand-mark" aria-hidden="true">VH</span><span><strong>VetHelp</strong><small>Портал клиники</small></span></div><nav className="vh-clinic-nav" aria-label="Разделы локации"><Navigation clinicId={clinicId} locationId={locationId} /></nav></aside>
    <div className="vh-clinic-main"><header className="vh-clinic-topbar" aria-label="Контекст локации"><div><p>Рабочая локация</p><h1>Clinic Portal</h1></div><span aria-label={`Clinic ${clinicId}, location ${locationId}`}>{locationId.slice(0, 8)}</span></header><div id="clinic-v51-content" className="vh-clinic-content" tabIndex={-1}>{children}</div></div>
    <nav className="vh-clinic-bottom-nav" aria-label="Быстрая навигация портала клиники"><Navigation clinicId={clinicId} locationId={locationId} /></nav>
  </div></EffectiveSessionProvider>;
}
