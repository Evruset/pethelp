'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEffectiveSession } from '@/components/auth/EffectiveSessionProvider';
import {
  ClinicWorkspaceHomeResponseError,
  fetchClinicWorkspaceHome,
  type ClinicWorkspaceHome as WorkspaceSnapshot,
  type WorkspaceAction,
  type WorkspaceSection,
} from '@/lib/api/clinic-workspace-home';

type ViewState = 'idle' | 'loading' | 'ready' | 'session-missing' | 'session-error' | 'forbidden' | 'technical';

export function workspaceActionHref(basePath: string, action: WorkspaceAction): string {
  if (action.route === 'queue') return `${basePath}/queue`;
  if (action.route === 'appointments') return `${basePath}/appointments`;
  throw new Error('UNSUPPORTED_WORKSPACE_ACTION');
}

export function ClinicWorkspaceHome({ clinicId, locationId }: { clinicId: string; locationId: string }) {
  const effective = useEffectiveSession();
  const [ownedSnapshot, setOwnedSnapshot] = useState<{ identityKey: string; value: WorkspaceSnapshot } | null>(null);
  const [state, setState] = useState<ViewState>('idle');
  const [stale, setStale] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const generation = useRef(0);
  const active = useRef<AbortController | null>(null);
  const identityKey = `${effective.session?.subjectId ?? ''}:${clinicId}:${locationId}`;
  const hasExactScope = effective.hasClinicScope(clinicId, locationId);
  const snapshot = hasExactScope && ownedSnapshot?.identityKey === identityKey ? ownedSnapshot.value : null;

  const clearProtectedSnapshot = useCallback((next: ViewState) => {
    generation.current += 1;
    active.current?.abort();
    active.current = null;
    setOwnedSnapshot(null);
    setLoadedAt(null);
    setStale(false);
    setState(next);
  }, []);

  const load = useCallback(async (refresh = false, restoreFocus = false) => {
    if (active.current || !effective.session || !hasExactScope) return;
    const requestGeneration = ++generation.current;
    const controller = new AbortController();
    active.current = controller;
    setRefreshing(refresh);
    if (!refresh || !snapshot) setState('loading');
    try {
      const parsed = await fetchClinicWorkspaceHome({ clinicId, locationId, signal: controller.signal });
      if (requestGeneration !== generation.current) return;
      setOwnedSnapshot({ identityKey, value: parsed });
      setLoadedAt(Date.now());
      setStale(false);
      setState('ready');
      if (restoreFocus) requestAnimationFrame(() => document.getElementById('workspace-heading')?.focus());
    } catch (error) {
      if (controller.signal.aborted || requestGeneration !== generation.current) return;
      if (error instanceof ClinicWorkspaceHomeResponseError && error.kind === 'http') {
        if (error.status === 401) return clearProtectedSnapshot('session-missing');
        if (error.status === 403) return clearProtectedSnapshot('forbidden');
        if (error.status !== undefined && error.status < 500) return clearProtectedSnapshot('technical');
      }
      if (snapshot) {
        setStale(true);
        setState('ready');
      } else setState('technical');
    } finally {
      if (active.current === controller) active.current = null;
      setRefreshing(false);
    }
  }, [clinicId, locationId, effective.session, hasExactScope, identityKey, snapshot, clearProtectedSnapshot]);

  useEffect(() => {
    if (effective.loading) { setState('loading'); return; }
    if (effective.error) { clearProtectedSnapshot('session-error'); return; }
    if (!effective.session) { clearProtectedSnapshot('session-missing'); return; }
    if (!hasExactScope) { clearProtectedSnapshot('forbidden'); return; }
    void load(false);
    return () => { generation.current += 1; active.current?.abort(); active.current = null; };
  // identityKey fences subject and route changes; session refreshes must not create duplicate fetches.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effective.loading, effective.error, identityKey, hasExactScope]);

  useEffect(() => {
    const restore = () => {
      if (document.visibilityState === 'visible' && loadedAt !== null && Date.now() - loadedAt > 30_000) void load(true);
    };
    document.addEventListener('visibilitychange', restore);
    return () => document.removeEventListener('visibilitychange', restore);
  }, [loadedAt, load]);

  if (effective.loading || state === 'loading' || state === 'idle') return <WorkspaceFeedback busy title="Загружаем рабочее пространство…" />;
  if (effective.error || state === 'session-error') return <WorkspaceFeedback alert title="Не удалось проверить сессию." action="Повторить проверку сессии" onAction={() => void effective.refresh()} />;
  if (!effective.session || state === 'session-missing') return <WorkspaceFeedback alert title="Сессия не найдена. Войдите снова." />;
  if (!hasExactScope || state === 'forbidden') return <WorkspaceFeedback alert title="Нет доступа к этой локации." />;
  if (state === 'technical' || !snapshot) return <WorkspaceFeedback alert title="Рабочее пространство временно недоступно." action="Повторить загрузку" onAction={() => void load(false, true)} />;

  return <WorkspaceContent snapshot={snapshot} clinicId={clinicId} locationId={locationId} stale={stale} refreshing={refreshing} loadedAt={loadedAt} onRefresh={(restoreFocus) => void load(true, restoreFocus)} />;
}

function WorkspaceFeedback({ title, busy = false, alert = false, action, onAction }: { title: string; busy?: boolean; alert?: boolean; action?: string; onAction?: () => void }) {
  return <section className="vh-workspace-feedback" role={alert ? 'alert' : 'status'} aria-live={busy ? 'polite' : undefined} aria-busy={busy || undefined}>
    <h2>{title}</h2>
    {action && <button className="vh-workspace-button" type="button" onClick={onAction}>{action}</button>}
  </section>;
}

function WorkspaceContent({ snapshot, clinicId, locationId, stale, refreshing, loadedAt, onRefresh }: { snapshot: WorkspaceSnapshot; clinicId: string; locationId: string; stale: boolean; refreshing: boolean; loadedAt: number | null; onRefresh: (restoreFocus?: boolean) => void }) {
  const basePath = `/clinics/${clinicId}/locations/${locationId}`;
  const visible = snapshot.sections.filter((section) => section.availability !== 'NOT_AUTHORIZED');
  const operational = visible.filter((section) => section.availability === 'AVAILABLE');
  const operationalEmpty = operational.length > 0 && operational.every((section) => section.kind === 'QUEUE'
    ? section.facts.waitingCount === 0 && section.facts.requiresActionCount === 0
    : section.facts.requiresActionCount === 0);
  const veterinarianOnly = visible.length === 1 && visible[0].kind === 'VETERINARIAN' && visible[0].availability === 'NOT_CONFIGURED';
  const lastUpdated = loadedAt ? new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(loadedAt) : '—';

  return <main className="vh-workspace" aria-labelledby="workspace-heading">
    <header className="vh-workspace-header">
      <div><p className="vh-workspace-eyebrow">Операционная сводка локации</p><h2 id="workspace-heading" tabIndex={-1}>Рабочее пространство</h2><p>Последнее обновление: <time>{lastUpdated}</time></p></div>
      <button className="vh-workspace-button" type="button" onClick={() => onRefresh()} aria-busy={refreshing || undefined} disabled={refreshing}>Обновить данные</button>
    </header>
    <p className="sr-only" role="status" aria-live="polite">{refreshing ? 'Обновляем рабочее пространство.' : ''}</p>
    {stale && <div className="vh-workspace-banner" role="status"><strong>Данные могут быть устаревшими.</strong><span> Последнее успешное обновление: {lastUpdated}.</span><button type="button" onClick={() => onRefresh(true)} disabled={refreshing}>Повторить обновление</button></div>}
    {operationalEmpty && <p className="vh-workspace-empty" role="status">Сейчас нет срочных операционных задач.</p>}
    {veterinarianOnly && <p className="vh-workspace-empty" role="status">Персональная сводка врача пока не подключена.</p>}
    {visible.length === 0 && <p className="vh-workspace-empty" role="status">Нет доступных сводок для этой учётной записи.</p>}
    <div className="vh-workspace-grid">{visible.map((section) => <WorkspaceCard key={section.kind} section={section} basePath={basePath} />)}</div>
  </main>;
}

const sectionNames: Record<WorkspaceSection['kind'], string> = { QUEUE: 'Очередь', SCHEDULE: 'Расписание', APPOINTMENTS: 'Приёмы', VETERINARIAN: 'Работа врача', QUALITY: 'Качество' };
function WorkspaceCard({ section, basePath }: { section: WorkspaceSection; basePath: string }) {
  if (section.availability === 'NOT_CONFIGURED') return <article className="vh-workspace-card vh-workspace-card--info"><h3>{sectionNames[section.kind]}</h3><p>Сводка раздела пока не настроена.</p></article>;
  if (section.availability === 'TEMPORARILY_UNAVAILABLE') return <article className="vh-workspace-card vh-workspace-card--error"><h3>{sectionNames[section.kind]}</h3><p>Данные раздела временно недоступны.</p></article>;
  if (section.availability !== 'AVAILABLE') return null;
  return <article className="vh-workspace-card vh-workspace-card--task"><h3>{sectionNames[section.kind]}</h3>
    {section.kind === 'QUEUE' ? <QueueFacts section={section} /> : <AppointmentFacts section={section} />}
    <Link className="vh-workspace-action" href={workspaceActionHref(basePath, section.action)}>{section.kind === 'QUEUE' ? 'Открыть очередь' : 'Открыть приёмы'}</Link>
  </article>;
}

const displayCount = (value: number) => value === 999 ? '999+' : String(value);
function QueueFacts({ section }: { section: Extract<WorkspaceSection, { kind: 'QUEUE'; availability: 'AVAILABLE' }> }) {
  const sla = { NONE: 'Нет риска', DUE_SOON: 'Требуется внимание', OVERDUE: 'SLA просрочен', UNKNOWN: 'Состояние уточняется' }[section.facts.slaRisk];
  const age = { NONE: 'Нет ожидающих', LT_5_MIN: 'Менее 5 минут', '5_TO_10_MIN': '5–10 минут', '10_TO_30_MIN': '10–30 минут', GT_30_MIN: 'Более 30 минут' }[section.facts.oldestWaitAgeBucket];
  return <><dl className="vh-workspace-facts"><div><dt>Ожидают</dt><dd>{displayCount(section.facts.waitingCount)}</dd></div><div><dt>Требуют действия</dt><dd>{displayCount(section.facts.requiresActionCount)}</dd></div></dl><p><strong>SLA:</strong> {sla}</p><p>Самое долгое ожидание: {age}</p></>;
}
function AppointmentFacts({ section }: { section: Extract<WorkspaceSection, { kind: 'APPOINTMENTS'; availability: 'AVAILABLE' }> }) {
  return <><dl className="vh-workspace-facts"><div><dt>Сегодня</dt><dd>{displayCount(section.facts.todayCount)}</dd></div><div><dt>Требуют действия</dt><dd>{displayCount(section.facts.requiresActionCount)}</dd></div></dl><p>Следующий приём: {section.facts.nextScheduledAt ? new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date(section.facts.nextScheduledAt)) : 'не запланирован'}</p></>;
}
