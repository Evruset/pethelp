import Link from 'next/link';
import type { ReactNode } from 'react';

type ClinicPortalShellProps = {
  clinicId: string;
  locationId: string;
  children: ReactNode;
};

const navItems = [
  { label: 'Очередь', href: 'queue', ariaLabel: 'Открыть очередь записей' },
  { label: 'Расписание', href: 'schedule', ariaLabel: 'Открыть расписание' },
  { label: 'Качество', href: 'quality', ariaLabel: 'Открыть quality dashboard' },
] as const;

export function ClinicPortalShell({ clinicId, locationId, children }: ClinicPortalShellProps) {
  const basePath = `/clinics/${clinicId}/locations/${locationId}`;

  return (
    <div className="vh-clinic-shell" data-testid="clinic-portal-shell">
      <aside className="vh-clinic-sidebar" aria-label="Навигация портала клиники">
        <div className="vh-clinic-brand" aria-label="VetHelp Clinic Portal">
          <span className="vh-clinic-brand-mark" aria-hidden="true">VH</span>
          <span>
            <strong>VetHelp</strong>
            <small>Портал клиники</small>
          </span>
        </div>
        <nav className="vh-clinic-nav" aria-label="Разделы локации">
          {navItems.map((item) => (
            <Link
              key={item.href}
              className="vh-clinic-nav-item"
              href={`${basePath}/${item.href}`}
              aria-label={item.ariaLabel}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="vh-clinic-main">
        <header className="vh-clinic-topbar" aria-label="Контекст локации">
          <div>
            <p>Рабочая локация</p>
            <h1>Clinic Portal</h1>
          </div>
          <span aria-label={`Clinic ${clinicId}, location ${locationId}`}>
            {locationId.slice(0, 8)}
          </span>
        </header>
        <main className="vh-clinic-content">{children}</main>
      </div>

      <nav className="vh-clinic-bottom-nav" aria-label="Быстрая навигация портала клиники">
        {navItems.map((item) => (
          <Link
            key={item.href}
            className="vh-clinic-bottom-nav-item"
            href={`${basePath}/${item.href}`}
            aria-label={item.ariaLabel}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
