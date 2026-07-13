'use client';

import { useCallback, useMemo, useState } from 'react';
import type { ClinicSchedule, ClinicSchedulePeriod, ClinicScheduleResource, ClinicScheduleService, ClinicScheduleSlot, ClinicScheduleStaff, ClinicWorkingHoursDay } from '@/lib/api/clinic-schedule';
import { useBookingCoordinator } from './useBookingCoordinator';

type Props = {
  clinicId: string;
  locationId: string;
  initialSchedule: ClinicSchedule;
  canCompleteAppointments: boolean;
};

type ServiceForm = {
  code: string;
  displayName: string;
  durationMinutes: number;
  priceAmount: string;
  currency: string;
  active: boolean;
};

type StaffForm = {
  code: string;
  displayName: string;
  role: string;
  active: boolean;
};

type ResourceForm = {
  code: string;
  displayName: string;
  resourceType: string;
  active: boolean;
};

type PeriodForm = {
  periodType: 'BLACKOUT' | 'VACATION' | 'EMERGENCY_DUTY';
  startsAt: string;
  endsAt: string;
  staffId: string;
  resourceId: string;
  reason: string;
};

type SlotActionState = {
  slotId: string;
  kind: 'blackout' | 'capacity';
  retryAttempt: number;
};

type SlotErrorSheet = {
  slotId: string;
  title: string;
  description: string;
};

const slotRetryDelays = [1000, 2000, 4000] as const;
const dt = (value: string) => new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
const tm = (value: string) => new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function localInputValue(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function statusLabel(slot: ClinicScheduleSlot): string {
  if (slot.state === 'CLOSED') return 'Закрыт';
  if (slot.status === 'BOOKED') return 'Заполнен';
  if (slot.status === 'LOCKED_BY_HOLD') return 'Есть удержание';
  return 'Доступен';
}

function isSlotLockedRetry(status: number, code?: string): boolean {
  return status === 409 && code === 'SLOT_LOCKED_RETRY';
}

function isHoldExpired(status: number, code?: string): boolean {
  return status === 422 && code === 'HOLD_EXPIRED';
}

function slotErrorSheet(slotId: string): SlotErrorSheet {
  return {
    slotId,
    title: 'Слот недоступен',
    description: 'Это время уже занято другим процессом. Пожалуйста, обновите расписание',
  };
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function serviceToForm(service: ClinicScheduleService): ServiceForm {
  return {
    code: service.code,
    displayName: service.displayName,
    durationMinutes: service.durationMinutes,
    priceAmount: service.priceAmount,
    currency: service.currency,
    active: service.active,
  };
}

function initialServiceDrafts(services: ClinicScheduleService[]): Record<string, ServiceForm> {
  return Object.fromEntries(services.map((service) => [service.id, serviceToForm(service)]));
}

function defaultServiceForm(): ServiceForm {
  return {
    code: '',
    displayName: '',
    durationMinutes: 30,
    priceAmount: '1000.00',
    currency: 'RUB',
    active: true,
  };
}

function staffToForm(staff: ClinicScheduleStaff): StaffForm {
  return {
    code: staff.code,
    displayName: staff.displayName,
    role: staff.role,
    active: staff.active,
  };
}

function resourceToForm(resource: ClinicScheduleResource): ResourceForm {
  return {
    code: resource.code,
    displayName: resource.displayName,
    resourceType: resource.resourceType,
    active: resource.active,
  };
}

function initialStaffDrafts(staff: ClinicScheduleStaff[]): Record<string, StaffForm> {
  return Object.fromEntries(staff.map((item) => [item.id, staffToForm(item)]));
}

function initialResourceDrafts(resources: ClinicScheduleResource[]): Record<string, ResourceForm> {
  return Object.fromEntries(resources.map((item) => [item.id, resourceToForm(item)]));
}

function defaultStaffForm(): StaffForm {
  return {
    code: '',
    displayName: '',
    role: 'VETERINARIAN',
    active: true,
  };
}

function defaultResourceForm(): ResourceForm {
  return {
    code: '',
    displayName: '',
    resourceType: 'CABINET',
    active: true,
  };
}

function defaultPeriodForm(): PeriodForm {
  return {
    periodType: 'BLACKOUT',
    startsAt: localInputValue(new Date(Date.now() + 2 * 60 * 60 * 1000)),
    endsAt: localInputValue(new Date(Date.now() + 4 * 60 * 60 * 1000)),
    staffId: '',
    resourceId: '',
    reason: '',
  };
}

function periodLabel(period: ClinicSchedulePeriod): string {
  if (period.periodType === 'VACATION') return 'Отпуск';
  if (period.periodType === 'EMERGENCY_DUTY') return 'Emergency duty';
  return 'Blackout';
}

function downloadText(filename: string, contentType: string, body: string): void {
  const blob = new Blob([body], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function recordExportAttempt(clinicId: string, locationId: string, headers: HeadersInit, body: { format: 'JSON' | 'CSV'; scope: 'SCHEDULE' | 'SLOTS'; rowsCount: number }): Promise<boolean> {
  const response = await fetch(`/api/clinic/${clinicId}/locations/${locationId}/schedule/export-attempts`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  return response.ok;
}

function csvCell(value: string | number | null | undefined): string {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function ClinicScheduleClient({ clinicId, locationId, initialSchedule, canCompleteAppointments }: Props) {
  const bookingCoordinator = useBookingCoordinator();
  const [schedule, setSchedule] = useState(initialSchedule);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [serviceId, setServiceId] = useState(initialSchedule.services.find((service) => service.active)?.id ?? '');
  const [staffId, setStaffId] = useState('');
  const [resourceId, setResourceId] = useState('');
  const [newService, setNewService] = useState<ServiceForm>(defaultServiceForm);
  const [newStaff, setNewStaff] = useState<StaffForm>(defaultStaffForm);
  const [newResource, setNewResource] = useState<ResourceForm>(defaultResourceForm);
  const [newPeriod, setNewPeriod] = useState<PeriodForm>(defaultPeriodForm);
  const [importJson, setImportJson] = useState('{\n  "slots": []\n}');
  const [serviceDrafts, setServiceDrafts] = useState<Record<string, ServiceForm>>(() => initialServiceDrafts(initialSchedule.services));
  const [staffDrafts, setStaffDrafts] = useState<Record<string, StaffForm>>(() => initialStaffDrafts(initialSchedule.staff));
  const [resourceDrafts, setResourceDrafts] = useState<Record<string, ResourceForm>>(() => initialResourceDrafts(initialSchedule.resources));
  const [startsAt, setStartsAt] = useState(localInputValue(new Date(Date.now() + 60 * 60 * 1000)));
  const [endsAt, setEndsAt] = useState(localInputValue(new Date(Date.now() + 90 * 60 * 1000)));
  const [capacity, setCapacity] = useState(1);
  const [workingHours, setWorkingHours] = useState<ClinicWorkingHoursDay[]>(initialSchedule.workingHours);
  const [slotAction, setSlotAction] = useState<SlotActionState | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [slotError, setSlotError] = useState<SlotErrorSheet | null>(null);
  const [capacityDialog, setCapacityDialog] = useState<{ slot: ClinicScheduleSlot; value: string } | null>(null);
  const [completionDialog, setCompletionDialog] = useState<{ slot: ClinicScheduleSlot; summary: string } | null>(null);
  const [blackoutDialog, setBlackoutDialog] = useState<ClinicScheduleSlot | null>(null);

  const range = useMemo(() => ({
    from: new Date().toISOString(),
    to: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  }), []);
  const activeServices = useMemo(() => schedule.services.filter((service) => service.active), [schedule.services]);
  const activeStaff = useMemo(() => schedule.staff.filter((staff) => staff.active), [schedule.staff]);
  const activeResources = useMemo(() => schedule.resources.filter((resource) => resource.active), [schedule.resources]);

  const postSlotWithRetry = useCallback(async (
    slot: ClinicScheduleSlot,
    kind: SlotActionState['kind'],
    path: string,
    body: unknown,
  ): Promise<{ ok: true; payload: unknown } | { ok: false; status: number; code?: string; exhaustedRetry?: boolean }> => {
    for (let attempt = 0; attempt <= slotRetryDelays.length; attempt += 1) {
      if (attempt > 0) {
        bookingCoordinator.releaseSlot(slot.id);
        await sleep(slotRetryDelays[attempt - 1]);
      }
      setSlotAction({ slotId: slot.id, kind, retryAttempt: attempt });
      const response = await fetch(path, {
        method: 'POST',
        headers: bookingCoordinator.headersForSlot(slot.id, {
          'Content-Type': 'application/json',
          'If-Match': String(slot.version),
        }),
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null) as { code?: string } | null;
      if (response.ok) return { ok: true, payload };
      if (isSlotLockedRetry(response.status, payload?.code) && attempt < slotRetryDelays.length) {
        continue;
      }
      return {
        ok: false,
        status: response.status,
        code: payload?.code,
        exhaustedRetry: isSlotLockedRetry(response.status, payload?.code),
      };
    }
    return { ok: false, status: 409, code: 'SLOT_LOCKED_RETRY', exhaustedRetry: true };
  }, [bookingCoordinator]);

  const refresh = useCallback(async () => {
    const url = new URL(`/api/clinic/${clinicId}/locations/${locationId}/schedule/slots`, window.location.origin);
    url.searchParams.set('from', range.from);
    url.searchParams.set('to', range.to);
    const response = await fetch(url, { cache: 'no-store' });
    if (response.status === 403) {
      window.location.assign('/forbidden');
      return;
    }
    const payload = await response.json().catch(() => null) as ClinicSchedule | null;
    if (!response.ok || !payload) {
      setNotice('Не удалось обновить расписание.');
      return;
    }
    setSchedule(payload);
    setWorkingHours(payload.workingHours);
    setServiceDrafts(initialServiceDrafts(payload.services));
    setStaffDrafts(initialStaffDrafts(payload.staff));
    setResourceDrafts(initialResourceDrafts(payload.resources));
    if (!payload.services.some((service) => service.id === serviceId && service.active)) {
      setServiceId(payload.services.find((service) => service.active)?.id ?? '');
    }
    if (staffId && !payload.staff.some((staff) => staff.id === staffId && staff.active)) setStaffId('');
    if (resourceId && !payload.resources.some((resource) => resource.id === resourceId && resource.active)) setResourceId('');
  }, [clinicId, locationId, range.from, range.to, resourceId, serviceId, staffId]);

  const updateServiceDraft = useCallback((id: string, patch: Partial<ServiceForm>) => {
    setServiceDrafts((current) => ({
      ...current,
      [id]: { ...current[id], ...patch },
    }));
  }, []);

  const updateStaffDraft = useCallback((id: string, patch: Partial<StaffForm>) => {
    setStaffDrafts((current) => ({
      ...current,
      [id]: { ...current[id], ...patch },
    }));
  }, []);

  const updateResourceDraft = useCallback((id: string, patch: Partial<ResourceForm>) => {
    setResourceDrafts((current) => ({
      ...current,
      [id]: { ...current[id], ...patch },
    }));
  }, []);

  const exportJson = useCallback(async () => {
    const audited = await recordExportAttempt(
      clinicId,
      locationId,
      bookingCoordinator.headers({ 'Content-Type': 'application/json' }),
      {
        format: 'JSON',
        scope: 'SCHEDULE',
        rowsCount: schedule.slots.length,
      },
    ).catch(() => false);
    if (!audited) setNotice('Экспорт выполнен, но audit временно недоступен.');
    downloadText(
      `vethelp-schedule-${locationId}-${new Date().toISOString().slice(0, 10)}.json`,
      'application/json;charset=utf-8',
      JSON.stringify(schedule, null, 2),
    );
  }, [bookingCoordinator, clinicId, locationId, schedule]);

  const exportCsv = useCallback(async () => {
    const header = ['slot_id', 'starts_at', 'ends_at', 'service', 'staff', 'resource', 'state', 'status', 'capacity', 'booked_count', 'held_count', 'source', 'integration_mode', 'version'];
    const rows = schedule.slots.map((slot) => [
      slot.id,
      slot.startsAt,
      slot.endsAt,
      slot.service?.displayName,
      slot.staff?.displayName,
      slot.resource?.displayName,
      slot.state,
      slot.status,
      slot.capacity,
      slot.bookedCount,
      slot.heldCount,
      slot.source,
      slot.integrationMode,
      slot.version,
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
    const audited = await recordExportAttempt(
      clinicId,
      locationId,
      bookingCoordinator.headers({ 'Content-Type': 'application/json' }),
      {
        format: 'CSV',
        scope: 'SLOTS',
        rowsCount: rows.length,
      },
    ).catch(() => false);
    if (!audited) setNotice('Экспорт выполнен, но audit временно недоступен.');
    downloadText(`vethelp-slots-${locationId}-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8', csv);
  }, [bookingCoordinator, clinicId, locationId, schedule.slots]);

  const createPeriod = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/clinic/${clinicId}/locations/${locationId}/schedule/periods`, {
        method: 'POST',
        headers: bookingCoordinator.headersForAttempt({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          periodType: newPeriod.periodType,
          startsAt: new Date(newPeriod.startsAt).toISOString(),
          endsAt: new Date(newPeriod.endsAt).toISOString(),
          staffId: newPeriod.staffId || null,
          resourceId: newPeriod.resourceId || null,
          reason: newPeriod.reason || null,
        }),
      });
      const payload = await response.json().catch(() => null) as { code?: string } | null;
      if (response.ok) {
        setNotice('Период расписания создан и зафиксирован в audit.');
        setNewPeriod(defaultPeriodForm());
        await refresh();
        return;
      }
      if (response.status === 409 && payload?.code === 'SCHEDULE_PERIOD_HAS_ACTIVE_BOOKINGS') {
        setNotice('Период пересекается с активными удержаниями или записями.');
        await refresh();
        return;
      }
      setNotice('Не удалось создать период. Проверьте тип, время и scope.');
    } catch {
      setNotice('Нет связи с VetHelp. Период не создан.');
    } finally {
      setBusy(false);
    }
  }, [bookingCoordinator, busy, clinicId, locationId, newPeriod, refresh]);

  const cancelPeriod = useCallback(async (period: ClinicSchedulePeriod) => {
    if (busy || !period.active) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/clinic/${clinicId}/locations/${locationId}/schedule/periods/${period.id}/cancel`, {
        method: 'POST',
        headers: bookingCoordinator.headersForAttempt({
          'Content-Type': 'application/json',
          'If-Match': String(period.version),
        }),
      });
      const payload = await response.json().catch(() => null) as { code?: string } | null;
      if (response.ok) {
        setNotice('Период отменен. Закрытые ранее слоты не переоткрываются автоматически.');
        await refresh();
        return;
      }
      if (response.status === 409 && payload?.code === 'SCHEDULE_PERIOD_VERSION_STALE') {
        setNotice('Период уже изменился. Данные обновлены.');
        await refresh();
        return;
      }
      setNotice('Не удалось отменить период.');
    } catch {
      setNotice('Нет связи с VetHelp. Период не отменен.');
    } finally {
      setBusy(false);
    }
  }, [bookingCoordinator, busy, clinicId, locationId, refresh]);

  const importManualSlots = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const parsed = JSON.parse(importJson) as { slots?: unknown };
      if (!Array.isArray(parsed.slots)) {
        setNotice('JSON должен содержать массив slots.');
        return;
      }
      const response = await fetch(`/api/clinic/${clinicId}/locations/${locationId}/schedule/import`, {
        method: 'POST',
        headers: bookingCoordinator.headersForAttempt({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ slots: parsed.slots }),
      });
      const payload = await response.json().catch(() => null) as { imported?: number; code?: string } | null;
      if (response.ok) {
        setNotice(`Импортировано окон: ${payload?.imported ?? 0}.`);
        await refresh();
        return;
      }
      setNotice(`Импорт не выполнен: ${payload?.code ?? 'INVALID_REQUEST'}.`);
    } catch {
      setNotice('Не удалось прочитать JSON импорта.');
    } finally {
      setBusy(false);
    }
  }, [bookingCoordinator, busy, clinicId, importJson, locationId, refresh]);

  const createService = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/clinic/${clinicId}/locations/${locationId}/schedule/services`, {
        method: 'POST',
        headers: bookingCoordinator.headersForAttempt({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(newService),
      });
      const payload = await response.json().catch(() => null) as { code?: string; id?: string } | null;
      if (response.ok) {
        setNotice('Услуга создана и зафиксирована в audit.');
        setNewService(defaultServiceForm());
        await refresh();
        if (payload?.id) setServiceId(payload.id);
        return;
      }
      if (response.status === 409 && payload?.code === 'SERVICE_CODE_EXISTS') {
        setNotice('Код услуги уже используется в этой локации.');
        return;
      }
      setNotice('Не удалось создать услугу. Проверьте код, цену и длительность.');
    } catch {
      setNotice('Нет связи с VetHelp. Услуга не создана.');
    } finally {
      setBusy(false);
    }
  }, [bookingCoordinator, busy, clinicId, locationId, newService, refresh]);

  const saveService = useCallback(async (service: ClinicScheduleService) => {
    if (busy) return;
    const draft = serviceDrafts[service.id];
    if (!draft) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/clinic/${clinicId}/locations/${locationId}/schedule/services/${service.id}`, {
        method: 'POST',
        headers: bookingCoordinator.headersForAttempt({
          'Content-Type': 'application/json',
          'If-Match': String(service.version),
        }),
        body: JSON.stringify(draft),
      });
      const payload = await response.json().catch(() => null) as { code?: string } | null;
      if (response.ok) {
        setNotice('Услуга обновлена и зафиксирована в audit.');
        await refresh();
        return;
      }
      if (response.status === 409 && payload?.code === 'SERVICE_HAS_ACTIVE_BOOKINGS') {
        setNotice('Нельзя выключить услугу с будущими удержаниями или записями.');
        await refresh();
        return;
      }
      if (response.status === 409 && payload?.code === 'SERVICE_VERSION_STALE') {
        setNotice('Услуга уже изменилась. Данные обновлены.');
        await refresh();
        return;
      }
      if (response.status === 409 && payload?.code === 'SERVICE_CODE_EXISTS') {
        setNotice('Код услуги уже используется в этой локации.');
        return;
      }
      setNotice('Не удалось обновить услугу.');
    } catch {
      setNotice('Нет связи с VetHelp. Услуга не обновлена.');
    } finally {
      setBusy(false);
    }
  }, [bookingCoordinator, busy, clinicId, locationId, refresh, serviceDrafts]);

  const createStaff = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/clinic/${clinicId}/locations/${locationId}/schedule/staff`, {
        method: 'POST',
        headers: bookingCoordinator.headersForAttempt({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(newStaff),
      });
      const payload = await response.json().catch(() => null) as { code?: string; id?: string } | null;
      if (response.ok) {
        setNotice('Специалист создан и зафиксирован в audit.');
        setNewStaff(defaultStaffForm());
        await refresh();
        if (payload?.id) setStaffId(payload.id);
        return;
      }
      if (response.status === 409 && payload?.code === 'STAFF_CODE_EXISTS') {
        setNotice('Код специалиста уже используется в этой локации.');
        return;
      }
      setNotice('Не удалось создать специалиста.');
    } catch {
      setNotice('Нет связи с VetHelp. Специалист не создан.');
    } finally {
      setBusy(false);
    }
  }, [bookingCoordinator, busy, clinicId, locationId, newStaff, refresh]);

  const saveStaff = useCallback(async (staff: ClinicScheduleStaff) => {
    if (busy) return;
    const draft = staffDrafts[staff.id];
    if (!draft) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/clinic/${clinicId}/locations/${locationId}/schedule/staff/${staff.id}`, {
        method: 'POST',
        headers: bookingCoordinator.headersForAttempt({
          'Content-Type': 'application/json',
          'If-Match': String(staff.version),
        }),
        body: JSON.stringify(draft),
      });
      const payload = await response.json().catch(() => null) as { code?: string } | null;
      if (response.ok) {
        setNotice('Специалист обновлен и зафиксирован в audit.');
        await refresh();
        return;
      }
      if (response.status === 409 && payload?.code === 'STAFF_HAS_ACTIVE_BOOKINGS') {
        setNotice('Нельзя выключить специалиста с будущими удержаниями или записями.');
        await refresh();
        return;
      }
      if (response.status === 409 && payload?.code === 'STAFF_VERSION_STALE') {
        setNotice('Специалист уже изменился. Данные обновлены.');
        await refresh();
        return;
      }
      if (response.status === 409 && payload?.code === 'STAFF_CODE_EXISTS') {
        setNotice('Код специалиста уже используется в этой локации.');
        return;
      }
      setNotice('Не удалось обновить специалиста.');
    } catch {
      setNotice('Нет связи с VetHelp. Специалист не обновлен.');
    } finally {
      setBusy(false);
    }
  }, [bookingCoordinator, busy, clinicId, locationId, refresh, staffDrafts]);

  const createResource = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/clinic/${clinicId}/locations/${locationId}/schedule/resources`, {
        method: 'POST',
        headers: bookingCoordinator.headersForAttempt({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(newResource),
      });
      const payload = await response.json().catch(() => null) as { code?: string; id?: string } | null;
      if (response.ok) {
        setNotice('Ресурс создан и зафиксирован в audit.');
        setNewResource(defaultResourceForm());
        await refresh();
        if (payload?.id) setResourceId(payload.id);
        return;
      }
      if (response.status === 409 && payload?.code === 'RESOURCE_CODE_EXISTS') {
        setNotice('Код ресурса уже используется в этой локации.');
        return;
      }
      setNotice('Не удалось создать ресурс.');
    } catch {
      setNotice('Нет связи с VetHelp. Ресурс не создан.');
    } finally {
      setBusy(false);
    }
  }, [bookingCoordinator, busy, clinicId, locationId, newResource, refresh]);

  const saveResource = useCallback(async (resource: ClinicScheduleResource) => {
    if (busy) return;
    const draft = resourceDrafts[resource.id];
    if (!draft) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/clinic/${clinicId}/locations/${locationId}/schedule/resources/${resource.id}`, {
        method: 'POST',
        headers: bookingCoordinator.headersForAttempt({
          'Content-Type': 'application/json',
          'If-Match': String(resource.version),
        }),
        body: JSON.stringify(draft),
      });
      const payload = await response.json().catch(() => null) as { code?: string } | null;
      if (response.ok) {
        setNotice('Ресурс обновлен и зафиксирован в audit.');
        await refresh();
        return;
      }
      if (response.status === 409 && payload?.code === 'RESOURCE_HAS_ACTIVE_BOOKINGS') {
        setNotice('Нельзя выключить ресурс с будущими удержаниями или записями.');
        await refresh();
        return;
      }
      if (response.status === 409 && payload?.code === 'RESOURCE_VERSION_STALE') {
        setNotice('Ресурс уже изменился. Данные обновлены.');
        await refresh();
        return;
      }
      if (response.status === 409 && payload?.code === 'RESOURCE_CODE_EXISTS') {
        setNotice('Код ресурса уже используется в этой локации.');
        return;
      }
      setNotice('Не удалось обновить ресурс.');
    } catch {
      setNotice('Нет связи с VetHelp. Ресурс не обновлен.');
    } finally {
      setBusy(false);
    }
  }, [bookingCoordinator, busy, clinicId, locationId, refresh, resourceDrafts]);

  const createManualSlot = useCallback(async () => {
    if (!serviceId || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/clinic/${clinicId}/locations/${locationId}/schedule/manual-slots`, {
        method: 'POST',
        headers: bookingCoordinator.headersForAttempt({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          serviceId,
          staffId: staffId || null,
          resourceId: resourceId || null,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
          capacity,
        }),
      });
      if (!response.ok) {
        setNotice('Не удалось создать окно. Проверьте время, услугу и доступ.');
        return;
      }
      setNotice('Ручное окно создано и зафиксировано в audit.');
      await refresh();
    } catch {
      setNotice('Нет связи с VetHelp. Окно не создано.');
    } finally {
      setBusy(false);
    }
  }, [bookingCoordinator, busy, capacity, clinicId, endsAt, locationId, refresh, resourceId, serviceId, staffId, startsAt]);

  const blackout = useCallback(async (slot: ClinicScheduleSlot) => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await postSlotWithRetry(
        slot,
        'blackout',
        `/api/clinic/${clinicId}/locations/${locationId}/schedule/slots/${slot.id}/blackout`,
        { reason: 'Закрыто сотрудником клиники в расписании' },
      );
      if (result.ok) {
        setSelectedSlotId(slot.id);
        setNotice('Окно закрыто. Расписание обновлено.');
        await refresh();
        return;
      }
      if (result.exhaustedRetry || isHoldExpired(result.status, result.code)) {
        setSlotError(slotErrorSheet(slot.id));
        return;
      }
      if (result.status === 409 && result.code === 'SLOT_HAS_ACTIVE_BOOKINGS') {
        setNotice('Нельзя закрыть окно с активным удержанием или записью.');
        await refresh();
        return;
      }
      if (result.status === 409) {
        setNotice('Окно уже изменилось. Расписание обновлено.');
        await refresh();
        return;
      }
      setNotice('Не удалось закрыть окно.');
    } catch {
      setNotice('Нет связи с VetHelp. Окно не закрыто.');
    } finally {
      setBusy(false);
      setSlotAction(null);
    }
  }, [busy, clinicId, locationId, postSlotWithRetry, refresh]);

  const updateCapacity = useCallback(async (slot: ClinicScheduleSlot, nextCapacity: number) => {
    if (busy) return;
    if (!Number.isInteger(nextCapacity) || nextCapacity < 1 || nextCapacity > 50) {
      setNotice('Capacity должна быть целым числом от 1 до 50.');
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const result = await postSlotWithRetry(
        slot,
        'capacity',
        `/api/clinic/${clinicId}/locations/${locationId}/schedule/slots/${slot.id}/capacity`,
        { capacity: nextCapacity },
      );
      if (result.ok) {
        setSelectedSlotId(slot.id);
        setNotice('Capacity обновлена. Расписание обновлено.');
        await refresh();
        return;
      }
      if (result.exhaustedRetry || isHoldExpired(result.status, result.code)) {
        setSlotError(slotErrorSheet(slot.id));
        return;
      }
      if (result.status === 409 && result.code === 'SLOT_HAS_ACTIVE_BOOKINGS') {
        setNotice('Нельзя менять capacity у окна с активным удержанием или записью.');
        await refresh();
        return;
      }
      if (result.status === 409) {
        setNotice('Окно уже изменилось. Расписание обновлено.');
        await refresh();
        return;
      }
      setNotice('Не удалось изменить capacity.');
    } catch {
      setNotice('Нет связи с VetHelp. Capacity не изменена.');
    } finally {
      setBusy(false);
      setSlotAction(null);
    }
  }, [busy, clinicId, locationId, postSlotWithRetry, refresh]);

  const completeAppointment = useCallback(async (slot: ClinicScheduleSlot, summary: string) => {
    if (busy || !slot.bookingHold || slot.bookingHold.state !== 'CONFIRMED') return;
    if (summary.trim().length < 3) {
      setNotice('Заключение должно содержать минимум 3 символа.');
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/clinic/booking-holds/${slot.bookingHold.id}/complete`, {
        method: 'POST',
        headers: bookingCoordinator.headers({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ summary }),
      });
      const payload = await response.json().catch(() => null) as { code?: string } | null;
      if (response.ok) {
        setNotice('Приём закрыт. Заключение отправлено владельцу.');
        await refresh();
        return;
      }
      if (response.status === 422 && payload?.code === 'INVALID_STATE_TRANSITION') {
        setNotice('Эту запись уже нельзя закрыть из расписания.');
        await refresh();
        return;
      }
      setNotice('Не удалось закрыть приём.');
    } catch {
      setNotice('Нет связи с VetHelp. Приём не закрыт.');
    } finally {
      setBusy(false);
    }
  }, [bookingCoordinator, busy, refresh]);

  const updateWorkingHour = useCallback((weekday: number, patch: Partial<ClinicWorkingHoursDay>) => {
    setWorkingHours((current) => current.map((day) => day.weekday === weekday ? { ...day, ...patch } : day));
  }, []);

  const saveWorkingHours = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/clinic/${clinicId}/locations/${locationId}/schedule/working-hours`, {
        method: 'POST',
        headers: bookingCoordinator.headersForAttempt({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          days: workingHours.map((day) => ({
            weekday: day.weekday,
            active: day.active,
            opensAt: day.active ? day.opensAt : null,
            closesAt: day.active ? day.closesAt : null,
          })),
        }),
      });
      if (!response.ok) {
        setNotice('Не удалось сохранить рабочие часы.');
        return;
      }
      setNotice('Рабочие часы обновлены и зафиксированы в audit.');
      await refresh();
    } catch {
      setNotice('Нет связи с VetHelp. Рабочие часы не сохранены.');
    } finally {
      setBusy(false);
    }
  }, [bookingCoordinator, busy, clinicId, locationId, refresh, workingHours]);

  return (
    <main className="min-h-screen px-4 py-6 sm:px-8 lg:px-12">
      <section className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-700">VetHelp · Schedule</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Расписание локации</h1>
            <p className="mt-2 text-sm text-slate-600">Ручные окна и blackout проходят через backend, audit и outbox. Окна с удержаниями не закрываются локально.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void exportJson()} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">JSON</button>
            <button type="button" onClick={() => void exportCsv()} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">CSV</button>
            <button type="button" onClick={() => void refresh()} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Обновить</button>
          </div>
        </header>

        {notice ? <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700" role="status">{notice}</div> : null}

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Рабочие часы</h2>
              <p className="mt-1 text-sm text-slate-600">Недельный график хранится на backend и используется как source metadata для ручного расписания.</p>
            </div>
            <button type="button" disabled={busy} onClick={() => void saveWorkingHours()} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600">
              {busy ? 'Сохраняем...' : 'Сохранить'}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-7">
            {workingHours.map((day) => (
              <div key={day.weekday} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <input type="checkbox" checked={day.active} onChange={(event) => updateWorkingHour(day.weekday, { active: event.target.checked })} />
                  {WEEKDAYS[day.weekday]}
                </label>
                <input type="time" disabled={!day.active} value={day.opensAt ?? '09:00'} onChange={(event) => updateWorkingHour(day.weekday, { opensAt: event.target.value })} className="mt-3 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-100" />
                <input type="time" disabled={!day.active} value={day.closesAt ?? '18:00'} onChange={(event) => updateWorkingHour(day.weekday, { closesAt: event.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-100" />
                <p className="mt-2 text-xs text-slate-500">{day.source}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Услуги локации</h2>
              <p className="mt-1 text-sm text-slate-600">Активные услуги доступны для новых ручных окон. Изменения проходят через backend, версию, audit и outbox.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-7 lg:w-[860px]">
              <input type="text" value={newService.code} onChange={(event) => setNewService((current) => ({ ...current, code: event.target.value }))} placeholder="code" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input type="text" value={newService.displayName} onChange={(event) => setNewService((current) => ({ ...current, displayName: event.target.value }))} placeholder="Название" className="sm:col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input type="number" min={5} max={480} value={newService.durationMinutes} onChange={(event) => setNewService((current) => ({ ...current, durationMinutes: Number(event.target.value) }))} aria-label="Длительность услуги" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input type="text" value={newService.priceAmount} onChange={(event) => setNewService((current) => ({ ...current, priceAmount: event.target.value }))} placeholder="1000.00" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input type="text" value={newService.currency} onChange={(event) => setNewService((current) => ({ ...current, currency: event.target.value.toUpperCase().slice(0, 3) }))} placeholder="RUB" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <button type="button" disabled={busy || !newService.code || !newService.displayName} onClick={() => void createService()} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600">
                Добавить
              </button>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full table-fixed border-collapse text-left">
              <thead className="border-y border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-36 px-3 py-3">Код</th>
                  <th className="w-64 px-3 py-3">Название</th>
                  <th className="w-32 px-3 py-3">Мин</th>
                  <th className="w-36 px-3 py-3">Цена</th>
                  <th className="w-28 px-3 py-3">Валюта</th>
                  <th className="w-32 px-3 py-3">Активна</th>
                  <th className="w-36 px-3 py-3">Версия</th>
                  <th className="w-36 px-3 py-3">Действие</th>
                </tr>
              </thead>
              <tbody>
                {schedule.services.map((service) => {
                  const draft = serviceDrafts[service.id] ?? serviceToForm(service);
                  return (
                    <tr key={service.id} className="border-b border-slate-200">
                      <td className="px-3 py-3 align-top"><input type="text" value={draft.code} onChange={(event) => updateServiceDraft(service.id, { code: event.target.value })} className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm" /></td>
                      <td className="px-3 py-3 align-top"><input type="text" value={draft.displayName} onChange={(event) => updateServiceDraft(service.id, { displayName: event.target.value })} className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm" /></td>
                      <td className="px-3 py-3 align-top"><input type="number" min={5} max={480} value={draft.durationMinutes} onChange={(event) => updateServiceDraft(service.id, { durationMinutes: Number(event.target.value) })} className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm" /></td>
                      <td className="px-3 py-3 align-top"><input type="text" value={draft.priceAmount} onChange={(event) => updateServiceDraft(service.id, { priceAmount: event.target.value })} className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm" /></td>
                      <td className="px-3 py-3 align-top"><input type="text" value={draft.currency} onChange={(event) => updateServiceDraft(service.id, { currency: event.target.value.toUpperCase().slice(0, 3) })} className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm" /></td>
                      <td className="px-3 py-3 align-top">
                        <label className="flex min-h-11 items-center gap-2 text-sm text-slate-700">
                          <input type="checkbox" checked={draft.active} onChange={(event) => updateServiceDraft(service.id, { active: event.target.checked })} />
                          {draft.active ? 'Да' : 'Нет'}
                        </label>
                      </td>
                      <td className="px-3 py-3 align-top text-sm text-slate-600">v{service.version}</td>
                      <td className="px-3 py-3 align-top"><button type="button" disabled={busy} onClick={() => void saveService(service)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400">Сохранить</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Специалисты</h2>
              <p className="mt-1 text-sm text-slate-600">Врачи и сотрудники могут быть закреплены за ручным окном. Source и версия остаются на backend.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-5 lg:w-[680px]">
              <input type="text" value={newStaff.code} onChange={(event) => setNewStaff((current) => ({ ...current, code: event.target.value }))} placeholder="code" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input type="text" value={newStaff.displayName} onChange={(event) => setNewStaff((current) => ({ ...current, displayName: event.target.value }))} placeholder="ФИО" className="sm:col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input type="text" value={newStaff.role} onChange={(event) => setNewStaff((current) => ({ ...current, role: event.target.value.toUpperCase() }))} placeholder="VETERINARIAN" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <button type="button" disabled={busy || !newStaff.code || !newStaff.displayName} onClick={() => void createStaff()} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600">Добавить</button>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full table-fixed border-collapse text-left">
              <thead className="border-y border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-36 px-3 py-3">Код</th>
                  <th className="w-64 px-3 py-3">ФИО</th>
                  <th className="w-44 px-3 py-3">Роль</th>
                  <th className="w-32 px-3 py-3">Активен</th>
                  <th className="w-36 px-3 py-3">Источник</th>
                  <th className="w-36 px-3 py-3">Действие</th>
                </tr>
              </thead>
              <tbody>
                {schedule.staff.map((staff) => {
                  const draft = staffDrafts[staff.id] ?? staffToForm(staff);
                  return (
                    <tr key={staff.id} className="border-b border-slate-200">
                      <td className="px-3 py-3 align-top"><input type="text" value={draft.code} onChange={(event) => updateStaffDraft(staff.id, { code: event.target.value })} className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm" /></td>
                      <td className="px-3 py-3 align-top"><input type="text" value={draft.displayName} onChange={(event) => updateStaffDraft(staff.id, { displayName: event.target.value })} className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm" /></td>
                      <td className="px-3 py-3 align-top"><input type="text" value={draft.role} onChange={(event) => updateStaffDraft(staff.id, { role: event.target.value.toUpperCase() })} className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm" /></td>
                      <td className="px-3 py-3 align-top"><label className="flex min-h-11 items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={draft.active} onChange={(event) => updateStaffDraft(staff.id, { active: event.target.checked })} />{draft.active ? 'Да' : 'Нет'}</label></td>
                      <td className="px-3 py-3 align-top text-sm text-slate-600">{staff.source} · v{staff.version}</td>
                      <td className="px-3 py-3 align-top"><button type="button" disabled={busy} onClick={() => void saveStaff(staff)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400">Сохранить</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Кабинеты и ресурсы</h2>
              <p className="mt-1 text-sm text-slate-600">Ресурс можно закрепить за ручным окном: кабинет, операционная, оборудование или duty-пул.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-5 lg:w-[680px]">
              <input type="text" value={newResource.code} onChange={(event) => setNewResource((current) => ({ ...current, code: event.target.value }))} placeholder="code" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input type="text" value={newResource.displayName} onChange={(event) => setNewResource((current) => ({ ...current, displayName: event.target.value }))} placeholder="Название" className="sm:col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input type="text" value={newResource.resourceType} onChange={(event) => setNewResource((current) => ({ ...current, resourceType: event.target.value.toUpperCase() }))} placeholder="CABINET" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <button type="button" disabled={busy || !newResource.code || !newResource.displayName} onClick={() => void createResource()} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600">Добавить</button>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full table-fixed border-collapse text-left">
              <thead className="border-y border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-36 px-3 py-3">Код</th>
                  <th className="w-64 px-3 py-3">Название</th>
                  <th className="w-44 px-3 py-3">Тип</th>
                  <th className="w-32 px-3 py-3">Активен</th>
                  <th className="w-36 px-3 py-3">Источник</th>
                  <th className="w-36 px-3 py-3">Действие</th>
                </tr>
              </thead>
              <tbody>
                {schedule.resources.map((resource) => {
                  const draft = resourceDrafts[resource.id] ?? resourceToForm(resource);
                  return (
                    <tr key={resource.id} className="border-b border-slate-200">
                      <td className="px-3 py-3 align-top"><input type="text" value={draft.code} onChange={(event) => updateResourceDraft(resource.id, { code: event.target.value })} className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm" /></td>
                      <td className="px-3 py-3 align-top"><input type="text" value={draft.displayName} onChange={(event) => updateResourceDraft(resource.id, { displayName: event.target.value })} className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm" /></td>
                      <td className="px-3 py-3 align-top"><input type="text" value={draft.resourceType} onChange={(event) => updateResourceDraft(resource.id, { resourceType: event.target.value.toUpperCase() })} className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm" /></td>
                      <td className="px-3 py-3 align-top"><label className="flex min-h-11 items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={draft.active} onChange={(event) => updateResourceDraft(resource.id, { active: event.target.checked })} />{draft.active ? 'Да' : 'Нет'}</label></td>
                      <td className="px-3 py-3 align-top text-sm text-slate-600">{resource.source} · v{resource.version}</td>
                      <td className="px-3 py-3 align-top"><button type="button" disabled={busy} onClick={() => void saveResource(resource)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400">Сохранить</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Периоды расписания</h2>
              <p className="mt-1 text-sm text-slate-600">Blackout и отпуск закрывают пустые пересекающиеся слоты. Emergency duty фиксируется как активный duty-интервал.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-7 lg:w-[960px]">
              <select value={newPeriod.periodType} onChange={(event) => setNewPeriod((current) => ({ ...current, periodType: event.target.value as PeriodForm['periodType'] }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="BLACKOUT">Blackout</option>
                <option value="VACATION">Отпуск</option>
                <option value="EMERGENCY_DUTY">Emergency duty</option>
              </select>
              <input type="datetime-local" value={newPeriod.startsAt} onChange={(event) => setNewPeriod((current) => ({ ...current, startsAt: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input type="datetime-local" value={newPeriod.endsAt} onChange={(event) => setNewPeriod((current) => ({ ...current, endsAt: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <select value={newPeriod.staffId} onChange={(event) => setNewPeriod((current) => ({ ...current, staffId: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">Любой специалист</option>
                {activeStaff.map((staff) => <option key={staff.id} value={staff.id}>{staff.displayName}</option>)}
              </select>
              <select value={newPeriod.resourceId} onChange={(event) => setNewPeriod((current) => ({ ...current, resourceId: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">Любой ресурс</option>
                {activeResources.map((resource) => <option key={resource.id} value={resource.id}>{resource.displayName}</option>)}
              </select>
              <input type="text" value={newPeriod.reason} onChange={(event) => setNewPeriod((current) => ({ ...current, reason: event.target.value }))} placeholder="Причина" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <button type="button" disabled={busy || !newPeriod.startsAt || !newPeriod.endsAt || (newPeriod.periodType === 'VACATION' && !newPeriod.staffId)} onClick={() => void createPeriod()} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600">Создать</button>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full table-fixed border-collapse text-left">
              <thead className="border-y border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-40 px-3 py-3">Тип</th>
                  <th className="w-56 px-3 py-3">Период</th>
                  <th className="w-56 px-3 py-3">Scope</th>
                  <th className="w-64 px-3 py-3">Причина</th>
                  <th className="w-36 px-3 py-3">Статус</th>
                  <th className="w-36 px-3 py-3">Действие</th>
                </tr>
              </thead>
              <tbody>
                {schedule.periods.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-600">Периодов в выбранном диапазоне нет.</td></tr>
                ) : schedule.periods.map((period) => (
                  <tr key={period.id} className="border-b border-slate-200">
                    <td className="px-3 py-3 align-top text-sm font-semibold text-slate-900">{periodLabel(period)}</td>
                    <td className="px-3 py-3 align-top text-sm text-slate-700"><p>{dt(period.startsAt)}</p><p className="mt-1 text-xs text-slate-500">{dt(period.endsAt)}</p></td>
                    <td className="px-3 py-3 align-top text-sm text-slate-700"><p>{period.staff?.displayName ?? 'Все специалисты'}</p><p className="mt-1 text-xs text-slate-500">{period.resource?.displayName ?? 'Все ресурсы'}</p></td>
                    <td className="px-3 py-3 align-top text-sm text-slate-700">{period.reason ?? 'Не указана'}</td>
                    <td className="px-3 py-3 align-top text-sm text-slate-600">{period.active ? 'Активен' : 'Отменен'} · v{period.version}</td>
                    <td className="px-3 py-3 align-top"><button type="button" disabled={busy || !period.active} onClick={() => void cancelPeriod(period)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400">Отменить</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Добавить ручное окно</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-6">
            <label className="md:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Услуга</span>
              <select value={serviceId} onChange={(event) => setServiceId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                {activeServices.map((service) => <option key={service.id} value={service.id}>{service.displayName}</option>)}
              </select>
            </label>
            <label>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Специалист</span>
              <select value={staffId} onChange={(event) => setStaffId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">Не задан</option>
                {activeStaff.map((staff) => <option key={staff.id} value={staff.id}>{staff.displayName}</option>)}
              </select>
            </label>
            <label>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ресурс</span>
              <select value={resourceId} onChange={(event) => setResourceId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">Не задан</option>
                {activeResources.map((resource) => <option key={resource.id} value={resource.id}>{resource.displayName}</option>)}
              </select>
            </label>
            <label>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Начало</span>
              <input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Конец</span>
              <input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Capacity</span>
              <input type="number" min={1} max={50} value={capacity} onChange={(event) => setCapacity(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>
          </div>
          {activeServices.length === 0 ? <p className="mt-3 text-sm text-amber-700">Сначала добавьте или включите услугу.</p> : null}
          <button type="button" disabled={!serviceId || activeServices.length === 0 || busy} onClick={() => void createManualSlot()} className="mt-4 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600">
            {busy ? 'Сохраняем...' : 'Создать окно'}
          </button>
        </section>

        <section className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Импорт расписания</h2>
              <p className="mt-1 text-sm text-slate-600">Manual import создает Level-C окна через backend, audit и outbox.</p>
            </div>
            <button type="button" disabled={busy} onClick={() => void importManualSlots()} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600">Импортировать</button>
          </div>
          <textarea value={importJson} onChange={(event) => setImportJson(event.target.value)} rows={8} spellCheck={false} className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-800" />
        </section>

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {schedule.slots.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-slate-600">На ближайшие 14 дней слоты не найдены.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed border-collapse text-left">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="w-44 px-4 py-3">Время</th>
                    <th className="w-56 px-4 py-3">Услуга</th>
                    <th className="w-56 px-4 py-3">Специалист / ресурс</th>
                    <th className="w-36 px-4 py-3">Статус</th>
                    <th className="w-36 px-4 py-3">Capacity</th>
                    <th className="w-44 px-4 py-3">Источник</th>
                    <th className="w-44 px-4 py-3">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.slots.map((slot) => {
                    const activeSlotAction = slotAction?.slotId === slot.id ? slotAction : null;
                    const slotSelected = selectedSlotId === slot.id;
                    const slotBusy = activeSlotAction != null;
                    return (
                    <tr
                      key={slot.id}
                      data-testid={`schedule-slot-${slot.id}`}
                      className={`vh-schedule-slot-row border-t border-slate-200 ${slotSelected ? 'vh-schedule-slot-row--selected' : ''} ${slotBusy ? 'vh-schedule-slot-row--busy' : ''}`}
                    >
                      <td className="px-4 py-4 align-top"><p className="text-sm font-semibold text-slate-950">{dt(slot.startsAt)}</p><p className="mt-1 text-xs text-slate-600">{tm(slot.startsAt)}-{tm(slot.endsAt)}</p></td>
                      <td className="px-4 py-4 align-top text-sm text-slate-700">{slot.service?.displayName ?? 'Услуга не указана'}</td>
                      <td className="px-4 py-4 align-top text-sm text-slate-700"><p>{slot.staff?.displayName ?? 'Специалист не задан'}</p><p className="mt-1 text-xs text-slate-500">{slot.resource?.displayName ?? 'Ресурс не задан'}</p></td>
                      <td className="px-4 py-4 align-top">
                        {slotBusy ? (
                          <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800" role="status">
                            <span className="vh-cupertino-spinner" aria-hidden="true" />
                            {activeSlotAction.retryAttempt > 0 ? `Повтор ${activeSlotAction.retryAttempt}/3` : 'Отправляем'}
                          </span>
                        ) : (
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${slot.state === 'CLOSED' ? 'bg-slate-100 text-slate-700' : slot.status === 'LOCKED_BY_HOLD' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}>{statusLabel(slot)}</span>
                        )}
                      </td>
                      <td className="px-4 py-4 align-top text-sm text-slate-700">{slot.bookedCount} записей · {slot.heldCount} holds · cap {slot.capacity}</td>
                      <td className="px-4 py-4 align-top text-sm text-slate-700"><p>{slot.source} · {slot.integrationMode}</p>{slot.stale ? <p className="mt-1 text-xs text-amber-700">Freshness устарел</p> : <p className="mt-1 text-xs text-slate-500">Fresh</p>}</td>
                      <td className="px-4 py-4 align-top">
                        <div className={`flex flex-col gap-2 ${slotBusy ? 'vh-schedule-slot-actions--busy' : ''}`}>
                          <button
                            type="button"
                            disabled={busy || slot.state === 'CLOSED' || slot.heldCount > 0 || slot.bookedCount > 0}
                            onClick={() => setCapacityDialog({ slot, value: String(slot.capacity) })}
                            className="vh-schedule-slot-action w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                          >
                            Capacity
                          </button>
                          <button
                            type="button"
                            disabled={busy || slot.state === 'CLOSED' || slot.heldCount > 0 || slot.bookedCount > 0}
                            onClick={() => setBlackoutDialog(slot)}
                            className="vh-schedule-slot-action w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                          >
                            Blackout
                          </button>
                          {canCompleteAppointments ? (
                            <button
                              type="button"
                              disabled={busy || slot.bookingHold?.state !== 'CONFIRMED'}
                              onClick={() => setCompletionDialog({ slot, summary: '' })}
                              className="vh-schedule-slot-action w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                            >
                              Закрыть приём
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );})}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
      {capacityDialog ? (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="capacity-dialog-title">
          <button
            type="button"
            aria-label="Закрыть"
            className="absolute inset-0 bg-slate-950/40"
            onClick={() => setCapacityDialog(null)}
            disabled={busy}
          />
          <section className="absolute left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-2xl">
            <header className="border-b border-slate-200 px-6 py-5">
              <h2 id="capacity-dialog-title" className="text-xl font-semibold text-slate-950">Изменить capacity</h2>
            </header>
            <div className="px-6 py-5">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Новая capacity</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={capacityDialog.value}
                  onChange={(event) => setCapacityDialog((current) => current ? { ...current, value: event.target.value } : null)}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            </div>
            <footer className="flex gap-3 border-t border-slate-200 px-6 py-4">
              <button type="button" onClick={() => setCapacityDialog(null)} disabled={busy} className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">Отмена</button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const dialog = capacityDialog;
                  setCapacityDialog(null);
                  void updateCapacity(dialog.slot, Number(dialog.value));
                }}
                className="flex-1 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
              >
                Сохранить
              </button>
            </footer>
          </section>
        </div>
      ) : null}
      {completionDialog ? (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="completion-dialog-title">
          <button
            type="button"
            aria-label="Закрыть"
            className="absolute inset-0 bg-slate-950/40"
            onClick={() => setCompletionDialog(null)}
            disabled={busy}
          />
          <section className="absolute left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-2xl">
            <header className="border-b border-slate-200 px-6 py-5">
              <h2 id="completion-dialog-title" className="text-xl font-semibold text-slate-950">Закрыть приём</h2>
            </header>
            <div className="px-6 py-5">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Заключение по приёму</span>
                <textarea
                  rows={5}
                  value={completionDialog.summary}
                  onChange={(event) => setCompletionDialog((current) => current ? { ...current, summary: event.target.value } : null)}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            </div>
            <footer className="flex gap-3 border-t border-slate-200 px-6 py-4">
              <button type="button" onClick={() => setCompletionDialog(null)} disabled={busy} className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">Отмена</button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const dialog = completionDialog;
                  setCompletionDialog(null);
                  void completeAppointment(dialog.slot, dialog.summary);
                }}
                className="flex-1 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
              >
                Закрыть приём
              </button>
            </footer>
          </section>
        </div>
      ) : null}
      {blackoutDialog ? (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="blackout-dialog-title">
          <button
            type="button"
            aria-label="Закрыть"
            className="absolute inset-0 bg-slate-950/40"
            onClick={() => setBlackoutDialog(null)}
            disabled={busy}
          />
          <section className="absolute left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-2xl">
            <header className="border-b border-slate-200 px-6 py-5">
              <h2 id="blackout-dialog-title" className="text-xl font-semibold text-slate-950">Закрыть окно</h2>
              <p className="mt-2 text-sm text-slate-600">{dt(blackoutDialog.startsAt)} · {blackoutDialog.service?.displayName ?? 'Услуга не указана'}</p>
            </header>
            <div className="px-6 py-5 text-sm leading-6 text-slate-700">
              Окно станет недоступно для записи. Действие будет зафиксировано в audit trail.
            </div>
            <footer className="flex gap-3 border-t border-slate-200 px-6 py-4">
              <button type="button" onClick={() => setBlackoutDialog(null)} disabled={busy} className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">Отмена</button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const slot = blackoutDialog;
                  setBlackoutDialog(null);
                  void blackout(slot);
                }}
                className="flex-1 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
              >
                Закрыть окно
              </button>
            </footer>
          </section>
        </div>
      ) : null}
      {slotError ? (
        <div className="vh-slide-over-backdrop" onClick={() => setSlotError(null)}>
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="slot-error-title"
            className="vh-slide-over"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="vh-system-alert">
              <p className="text-sm font-semibold text-red-700">Ошибка слота</p>
              <h2 id="slot-error-title" className="mt-2 text-xl font-semibold tracking-tight text-slate-950">{slotError.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{slotError.description}</p>
              <button
                type="button"
                className="mt-5 w-full rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white"
                onClick={() => {
                  setSlotError(null);
                  void refresh();
                }}
              >
                Обновить расписание
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </main>
  );
}
