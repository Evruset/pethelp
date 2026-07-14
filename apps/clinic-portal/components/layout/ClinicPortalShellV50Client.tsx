'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { EffectiveSessionProvider, useEffectiveSession } from '@/components/auth/EffectiveSessionProvider';
import { clinicShellPersona, resolveClinicShellNavigation } from './clinicPortalShellNavigation';

function shortIdentifier(value: string): string {
  return value.length > 12 ? `${value.slice(0, 8)}…` : value;
}

function ShellNavigation({ clinicId, locationId, compact = false }: { clinicId: string; locationId: string; compact?: boolean }) {
  const pathname = usePathname();
  const { session, loading, error, hasCapability, hasClinicScope, refresh } = useEffectiveSession();
  const basePath = `/clinics/${clinicId}/locations/${locationId}`;
  const hasExactScope = hasClinicScope(clinicId, locationId);
  const items = loading || error || !session || !hasExactScope
    ? []
    : resolveClinicShellNavigation(session.roles, hasCapability);

  if (loading) {
    return <p className="vh-v50-shell-state" aria-live="polite" aria-busy="true">Загрузка доступа…</p>;
  }

  if (error) {
    return (
      <div className="vh-v50-shell-state vh-v50-shell-state--error" role="alert">
        Доступ к capability-разделам недоступен.{' '}
        <button type="button" onClick={() => void refresh()}>Повторить</button>
      </div>
    );
  }

  if (!session) {
    return <p className="vh-v50-shell-state" role="status">Сессия не найдена. Войдите снова.</p>;
  }

  if (!hasExactScope) {
    return <p className="vh-v50-shell-state vh-v50-shell-state--forbidden" role="alert">Нет доступа к этой локации.</p>;
  }

  if (items.length === 0) {
    return <p className="vh-v50-shell-state" role="status">Нет доступных разделов.</p>;
  }

  return items.map((item) => {
    const href = `${basePath}/${item.href}`;
    const selected = pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        key={item.href}
        className={compact ? 'vh-clinic-bottom-nav-item' : 'vh-clinic-nav-item'}
        href={href}
        aria-current={selected ? 'page' : undefined}
        aria-label={item.ariaLabel}
        data-selected={selected ? 'true' : 'false'}
      >
        <span className="vh-v50-nav-icon" aria-hidden="true">{item.icon}</span>
        <span className="vh-v50-nav-label">{compact ? item.shortLabel : item.label}</span>
      </Link>
    );
  });
}

function ShellFrame({ clinicId, locationId, children }: { clinicId: string; locationId: string; children: ReactNode }) {
  const { session } = useEffectiveSession();
  const persona = clinicShellPersona(session?.roles ?? []);
  const roleLabel = persona === 'multi-role'
    ? 'Ресепшен и врач'
    : persona === 'reception'
      ? 'Ресепшен'
      : persona === 'veterinarian'
        ? 'Врач'
        : 'Сотрудник';

  return (
    <div
      className="vh-clinic-shell vh-v50-clinic-shell"
      data-testid="clinic-portal-shell"
      data-shell-version="v50"
      data-shell-role={persona}
    >
      <a className="vh-v50-skip-link vh-v51-skip-link" href="#clinic-v50-content">Перейти к содержимому</a>

      <aside className="vh-clinic-sidebar" aria-label="Навигация портала клиники">
        <div className="vh-clinic-brand" aria-label="VetHelp Clinic Portal">
          <span className="vh-clinic-brand-mark" aria-hidden="true">VH</span>
          <span className="vh-v50-brand-copy">
            <strong>VetHelp</strong>
            <small>Портал клиники</small>
          </span>
        </div>
        <p className="vh-v50-role-label">Рабочее место · {roleLabel}</p>
        <nav className="vh-clinic-nav" aria-label={`Разделы локации для роли ${roleLabel}`}>
          <ShellNavigation clinicId={clinicId} locationId={locationId} />
        </nav>
        <p className="vh-v50-authority-note">Доступ и действия подтверждает сервер.</p>
      </aside>

      <div className="vh-clinic-main">
        <header className="vh-clinic-topbar" aria-label="Контекст клиники и локации">
          <div className="vh-v50-context-path">
            <p>Клиника {shortIdentifier(clinicId)} / локация {shortIdentifier(locationId)}</p>
            <h1>{roleLabel}</h1>
          </div>
          <span className="vh-v50-location-badge" aria-label={`Clinic ${clinicId}, location ${locationId}`}>
            {shortIdentifier(locationId)}
          </span>
        </header>
        <div id="clinic-v50-content" className="vh-clinic-content" tabIndex={-1}>
          <div id="clinic-v51-content" className="vh-v50-content-compat">{children}</div>
        </div>
      </div>

      <nav className="vh-clinic-bottom-nav" aria-label="Быстрая навигация портала клиники">
        <ShellNavigation clinicId={clinicId} locationId={locationId} compact />
      </nav>
    </div>
  );
}

export function ClinicPortalShellV50Client({ clinicId, locationId, children }: { clinicId: string; locationId: string; children: ReactNode }) {
  return (
    <EffectiveSessionProvider>
      <ShellFrame clinicId={clinicId} locationId={locationId}>{children}</ShellFrame>
    </EffectiveSessionProvider>
  );
}
