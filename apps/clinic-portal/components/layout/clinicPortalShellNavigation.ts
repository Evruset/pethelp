export type ClinicShellNavigationItem = {
  label: string;
  shortLabel: string;
  href: string;
  ariaLabel: string;
  capability: string;
  icon: string;
};

const workspaceCapabilities = ['booking.queue.read', 'appointment.registry.read', 'schedule.read', 'clinical.visit.workspace.read', 'quality.read'] as const;
const homeNavigation: ClinicShellNavigationItem = { label: 'Главная', shortLabel: 'Главная', href: '', ariaLabel: 'Открыть рабочее пространство', capability: 'workspace.presentation', icon: 'Г' };

const receptionNavigation: readonly ClinicShellNavigationItem[] = [
  { label: 'Очередь', shortLabel: 'Очередь', href: 'queue', ariaLabel: 'Открыть очередь записей', capability: 'booking.queue.read', icon: 'О' },
  { label: 'Расписание', shortLabel: 'Слоты', href: 'schedule', ariaLabel: 'Открыть расписание', capability: 'schedule.read', icon: 'Р' },
  { label: 'Пациенты', shortLabel: 'Пациенты', href: 'patients', ariaLabel: 'Открыть реестр пациентов', capability: 'patient.admin.read', icon: 'П' },
  { label: 'Качество', shortLabel: 'Качество', href: 'quality', ariaLabel: 'Открыть панель качества', capability: 'quality.read', icon: 'К' },
] as const;

const veterinarianNavigation: readonly ClinicShellNavigationItem[] = [
  { label: 'Мои приёмы', shortLabel: 'Приёмы', href: 'vet/visits', ariaLabel: 'Открыть приёмы врача', capability: 'clinical.visit.workspace.read', icon: 'П' },
  { label: 'Расписание', shortLabel: 'Слоты', href: 'schedule', ariaLabel: 'Открыть расписание', capability: 'schedule.read', icon: 'Р' },
] as const;

const receptionRoles = new Set(['CLINIC_RECEPTIONIST', 'CLINIC_ADMIN']);
const veterinarianRoles = new Set(['CLINIC_VETERINARIAN', 'TELEMED_VETERINARIAN']);

export function clinicShellPersona(roles: readonly string[]): 'reception' | 'veterinarian' | 'multi-role' | 'staff' {
  const reception = roles.some((role) => receptionRoles.has(role));
  const veterinarian = roles.some((role) => veterinarianRoles.has(role));
  if (reception && veterinarian) return 'multi-role';
  if (reception) return 'reception';
  if (veterinarian) return 'veterinarian';
  return 'staff';
}

export function resolveClinicShellNavigation(
  roles: readonly string[],
  hasCapability: (capability: string) => boolean,
  patientsEnabled = false,
  workspaceHomeEnabled = false,
): ClinicShellNavigationItem[] {
  const persona = clinicShellPersona(roles);
  const candidates = persona === 'multi-role'
    ? [...receptionNavigation, ...veterinarianNavigation]
    : persona === 'reception'
      ? receptionNavigation
      : persona === 'veterinarian'
        ? veterinarianNavigation
        : [];

  const permitted = new Map<string, ClinicShellNavigationItem>();
  if (workspaceHomeEnabled && workspaceCapabilities.some(hasCapability)) permitted.set('', homeNavigation);
  for (const item of candidates) {
    if (item.href === 'patients' && !patientsEnabled) continue;
    if (hasCapability(item.capability) && !permitted.has(item.href)) {
      permitted.set(item.href, item);
    }
  }
  return [...permitted.values()];
}
