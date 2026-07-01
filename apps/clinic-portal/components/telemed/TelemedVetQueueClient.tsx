'use client';

import { useMemo, useState } from 'react';
import type { TelemedVetCase, TelemedVetQueue } from '@/lib/api/telemed-vet';

type Props = {
  initialQueue: TelemedVetQueue;
};

const intakeLabels: Record<string, string> = {
  SKIN_EAR_EYE: 'Кожа, уши или глаза',
  NUTRITION: 'Питание',
  BEHAVIOR: 'Поведение',
  MEDICATION_QUESTION: 'Вопрос по назначению',
  POST_VISIT_FOLLOW_UP: 'Контроль после визита',
  VOMITING_DIARRHEA: 'Рвота или диарея',
  PAIN_LAMENESS: 'Боль или хромота',
  GENERAL_QUESTION: 'Общий вопрос',
  OTHER: 'Другое',
};

const stateLabels: Record<string, string> = {
  QUEUED: 'В очереди',
  ASSIGNED: 'Назначен ветеринару',
  WAITING_FOR_DOCTOR: 'Ожидает врача',
  DOCTOR_JOINED: 'Ветеринар подключён',
  IN_PROGRESS: 'Консультация идёт',
  CANCELLED: 'Отменено владельцем',
  CANCELLED_BY_OWNER: 'Отменено владельцем',
  EXPIRED: 'Сессия устарела',
};

const retryableCodes = new Set([
  'TELEMED_CASE_WORKSPACE_CLOSED',
  'TELEMED_CASE_STATE_CONFLICT',
  'TELEMED_SESSION_STATE_CONFLICT',
  'TELEMED_CASE_ALREADY_ASSIGNED',
  'CASE_VERSION_STALE',
]);

const eventLabels: Record<string, string> = {
  TELEMED_SESSION_STARTED: 'Комната ожидания открыта',
  TELEMED_DOCTOR_CONNECTED: 'Ветеринар подключён',
  TELEMED_SESSION_CANCELLED_BY_OWNER: 'Владелец отменил консультацию',
};

function stateLabel(state: string): string {
  return stateLabels[state] ?? 'Статус ожидает обновления';
}

function isTerminalState(state: string): boolean {
  return state === 'CANCELLED' || state === 'CANCELLED_BY_OWNER' || state === 'EXPIRED';
}

function errorMessage(code: string): string {
  if (retryableCodes.has(code)) {
    return 'Состояние консультации обновилось. Обновите очередь и повторите действие вручную.';
  }
  if (code === 'BACKEND_UNAVAILABLE' || code === 'SESSION_START_FAILED' || code === 'DOCTOR_CONNECT_FAILED') {
    return 'Связь с VetHelp временно недоступна. Повторите действие после обновления состояния.';
  }
  if (code === 'QUEUE_REFRESH_FAILED') {
    return 'Не удалось обновить очередь. Проверьте соединение и повторите действие.';
  }
  return 'Не удалось выполнить действие. Обновите очередь и повторите попытку.';
}

function eventLabel(eventType: string): string {
  return eventLabels[eventType] ?? 'Событие обновлено';
}

async function parseError(response: Response, fallback: string): Promise<string> {
  const payload = await response.json().catch(() => null) as { code?: unknown } | null;
  return typeof payload?.code === 'string' ? payload.code : fallback;
}

export function TelemedVetQueueClient({ initialQueue }: Props) {
  const [queue, setQueue] = useState(initialQueue);
  const [selectedId, setSelectedId] = useState(queue.availableCases[0]?.caseId ?? queue.assignedCases[0]?.caseId ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [roomStatus, setRoomStatus] = useState<string | null>(null);

  const selected = useMemo(
    () => [...queue.availableCases, ...queue.assignedCases].find((item) => item.caseId === selectedId) ?? null,
    [queue, selectedId],
  );

  async function refresh() {
    const response = await fetch('/api/telemed/vet/queue', { cache: 'no-store' });
    if (!response.ok) throw new Error('QUEUE_REFRESH_FAILED');
    setQueue(await response.json() as TelemedVetQueue);
  }

  async function refreshAfterConflict(caseId: string) {
    await refresh().catch(() => undefined);
    setSelectedId(caseId);
  }

  async function assign(caseId: string) {
    setBusy(caseId);
    setError(null);
    try {
      const response = await fetch(`/api/telemed/vet/cases/${caseId}/assign`, { method: 'POST' });
      if (!response.ok) throw new Error(await parseError(response, 'ASSIGN_FAILED'));
      const updated = await response.json() as TelemedVetCase;
      setSelectedId(updated.caseId);
      await refresh();
    } catch (err) {
      const code = err instanceof Error ? err.message : 'ASSIGN_FAILED';
      setError(errorMessage(code));
      if (retryableCodes.has(code)) await refreshAfterConflict(caseId);
    } finally {
      setBusy(null);
    }
  }

  async function updateWorkspace(caseId: string, body: { safetyEscalation?: boolean; recommendationText?: string; followUpNotes?: string }) {
    setBusy(caseId);
    setError(null);
    try {
      const response = await fetch(`/api/telemed/vet/cases/${caseId}/workspace`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(await parseError(response, 'WORKSPACE_UPDATE_FAILED'));
      const updated = await response.json() as TelemedVetCase;
      setQueue((current) => ({
        ...current,
        availableCases: current.availableCases.map((item) => item.caseId === updated.caseId ? updated : item),
        assignedCases: current.assignedCases.map((item) => item.caseId === updated.caseId ? updated : item),
      }));
      setSelectedId(updated.caseId);
    } catch (err) {
      const code = err instanceof Error ? err.message : 'WORKSPACE_UPDATE_FAILED';
      setError(errorMessage(code));
      if (retryableCodes.has(code)) await refreshAfterConflict(caseId);
    } finally {
      setBusy(null);
    }
  }

  async function startSession(caseId: string) {
    setBusy(caseId);
    setError(null);
    setRoomStatus(null);
    try {
      const response = await fetch(`/api/telemed/vet/cases/${caseId}/start-session`, { method: 'POST' });
      if (!response.ok) throw new Error(await parseError(response, 'SESSION_START_FAILED'));
      const session = await response.json() as { id: string };
      setRoomStatus(`Комната ожидания открыта: ${session.id}`);
      await refresh();
      setSelectedId(caseId);
    } catch (err) {
      const code = err instanceof Error ? err.message : 'SESSION_START_FAILED';
      setError(errorMessage(code));
      if (retryableCodes.has(code)) await refreshAfterConflict(caseId);
    } finally {
      setBusy(null);
    }
  }

  async function connectDoctor(caseId: string, sessionId: string) {
    setBusy(caseId);
    setError(null);
    setRoomStatus(null);
    try {
      const response = await fetch(`/api/telemed/vet/cases/${caseId}/sessions/${sessionId}/connect`, { method: 'POST' });
      if (!response.ok) throw new Error(await parseError(response, 'DOCTOR_CONNECT_FAILED'));
      await response.json();
      setRoomStatus('Ветеринар подключён к консультации.');
      await refresh();
      setSelectedId(caseId);
    } catch (err) {
      const code = err instanceof Error ? err.message : 'DOCTOR_CONNECT_FAILED';
      setError(errorMessage(code));
      if (retryableCodes.has(code)) await refreshAfterConflict(caseId);
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-8 lg:px-10">
      <section className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[380px_1fr]" data-testid="telemed-vet-workspace">
        <aside className="space-y-4">
          <header className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-blue-700">VetHelp · Telemed</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Vet Queue</h1>
            <p className="mt-2 text-sm text-slate-600">Серверное время: {new Date(queue.serverNow).toLocaleString('ru-RU')}</p>
          </header>
          {error ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
          <CaseList title="Available cases" cases={queue.availableCases} selectedId={selectedId} busy={busy} onSelect={setSelectedId} onAssign={assign} />
          <CaseList title="Assigned cases" cases={queue.assignedCases} selectedId={selectedId} busy={busy} onSelect={setSelectedId} />
        </aside>
        <section className="min-h-[640px] rounded-lg border border-slate-200 bg-white p-5">
          {selected ? (
            <CaseWorkspace
              item={selected}
              busy={busy === selected.caseId}
              policy={queue.restrictedOutputPolicy}
              roomStatus={roomStatus}
              onUpdate={(body) => updateWorkspace(selected.caseId, body)}
              onStartSession={() => startSession(selected.caseId)}
              onConnectDoctor={selected.session ? () => connectDoctor(selected.caseId, selected.session!.id) : undefined}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-500" data-testid="telemed-empty-state">Очередь пуста</div>
          )}
        </section>
      </section>
    </main>
  );
}

function CaseList({ title, cases, selectedId, busy, onSelect, onAssign }: {
  title: string;
  cases: TelemedVetCase[];
  selectedId: string;
  busy: string | null;
  onSelect: (caseId: string) => void;
  onAssign?: (caseId: string) => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">{title}</div>
      <div className="divide-y divide-slate-100">
        {cases.length === 0 ? <p className="px-4 py-5 text-sm text-slate-500">Нет кейсов</p> : null}
        {cases.map((item) => (
          <article
            key={item.caseId}
            className={`px-4 py-3 ${selectedId === item.caseId ? 'bg-blue-50' : 'bg-white hover:bg-slate-50'}`}
            data-testid={`telemed-case-${item.caseId}`}
          >
            <button
              type="button"
              onClick={() => onSelect(item.caseId)}
              className="block min-h-11 w-full rounded-md text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              aria-pressed={selectedId === item.caseId}
              aria-label={`Открыть кейс ${item.pet.name}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">{item.pet.name} · {intakeLabels[item.intake.category] ?? item.intake.category}</p>
                  <p className="mt-1 text-xs text-slate-700">priority {item.queuePriority} · {item.serviceLevel}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-700">{stateLabel(item.state)}</p>
                </div>
                {item.safetyEscalation ? <span className="rounded bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">escalated</span> : null}
              </div>
            </button>
            {onAssign ? (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => onAssign(item.caseId)}
                  disabled={busy === item.caseId || isTerminalState(item.state)}
                  className="inline-flex min-h-11 items-center rounded-md bg-slate-900 px-3 text-xs font-semibold text-white disabled:opacity-50"
                  aria-label={`Назначить кейс ${item.pet.name} себе`}
                >
                  {busy === item.caseId ? 'Назначаем' : 'Назначить мне'}
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function CaseWorkspace({ item, busy, policy, roomStatus, onUpdate, onStartSession, onConnectDoctor }: {
  item: TelemedVetCase;
  busy: boolean;
  policy: TelemedVetQueue['restrictedOutputPolicy'];
  roomStatus: string | null;
  onUpdate: (body: { safetyEscalation?: boolean; recommendationText?: string; followUpNotes?: string }) => void;
  onStartSession: () => void;
  onConnectDoctor?: () => void;
}) {
  const [recommendation, setRecommendation] = useState(item.recommendationText ?? '');
  const [followUp, setFollowUp] = useState(item.followUpNotes ?? '');
  const terminal = isTerminalState(item.state);
  const canStartSession = !terminal && item.state === 'ASSIGNED' && !item.session;
  const canConnectDoctor = !terminal && item.session?.state === 'WAITING_FOR_DOCTOR' && Boolean(onConnectDoctor);

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_340px]" data-testid={`telemed-workspace-${item.caseId}`}>
      <section>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-blue-700">{stateLabel(item.state)}</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{item.pet.name}</h2>
            <p className="mt-1 text-sm text-slate-600">{item.pet.species}{item.pet.breed ? ` · ${item.pet.breed}` : ''}{item.pet.weightKg ? ` · ${item.pet.weightKg} кг` : ''}</p>
          </div>
          <button
            type="button"
            disabled={busy || terminal}
            onClick={() => onUpdate({ safetyEscalation: true })}
            className="min-h-11 rounded-md border border-red-200 px-3 text-sm font-semibold text-red-700 disabled:opacity-50"
            aria-label={`Отметить риск безопасности для ${item.pet.name}`}
          >
            Safety escalation
          </button>
        </div>

        {terminal ? (
          <div role="status" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Консультация недоступна для действий: {stateLabel(item.state)}.
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <Info label="Question" value={intakeLabels[item.intake.category] ?? item.intake.category} />
          <Info label="Duration" value={item.intake.symptomDuration} />
          <Info label="Prior clinic visit" value={item.intake.priorClinicVisit ? 'yes' : 'no'} />
          <Info label="Emergency red flags" value={item.intake.emergencyRedFlags.length ? item.intake.emergencyRedFlags.join(', ') : 'none'} />
          <Info label="Allergies" value={item.pet.allergies.length ? item.pet.allergies.join(', ') : 'none'} />
          <Info label="Chronic conditions" value={item.pet.chronicConditions.length ? item.pet.chronicConditions.join(', ') : 'none'} />
        </div>

        <section className="mt-5">
          <label className="text-sm font-semibold text-slate-900" htmlFor="recommendation">Recommendation template</label>
          <textarea
            id="recommendation"
            value={recommendation}
            onChange={(event) => setRecommendation(event.target.value)}
            className="mt-2 min-h-40 w-full rounded-md border border-slate-300 p-3 text-sm outline-none focus:border-blue-500"
            placeholder="Educational guidance, next safe step, monitoring checklist..."
            disabled={terminal}
          />
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={busy || terminal || recommendation.trim().length === 0}
              onClick={() => onUpdate({ recommendationText: recommendation })}
              className="min-h-11 rounded-md bg-blue-700 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              Save recommendation
            </button>
          </div>
        </section>

        <section className="mt-5">
          <label className="text-sm font-semibold text-slate-900" htmlFor="follow-up">Follow-up routing</label>
          <textarea
            id="follow-up"
            value={followUp}
            onChange={(event) => setFollowUp(event.target.value)}
            className="mt-2 min-h-24 w-full rounded-md border border-slate-300 p-3 text-sm outline-none focus:border-blue-500"
            placeholder="Follow-up checklist or clinic booking recommendation..."
            disabled={terminal}
          />
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={busy || terminal || followUp.trim().length === 0}
              onClick={() => onUpdate({ followUpNotes: followUp })}
              className="min-h-11 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              Save follow-up
            </button>
          </div>
        </section>
      </section>

      <aside className="space-y-4">
        <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-950">Restricted output policy</h3>
          <p className="mt-3 text-xs font-semibold uppercase text-slate-500">Allowed</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {policy.allowed.map((policyItem) => <li key={policyItem}>{policyItem}</li>)}
          </ul>
          <p className="mt-3 text-xs font-semibold uppercase text-red-600">Forbidden</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {policy.forbidden.map((policyItem) => <li key={policyItem}>{policyItem}</li>)}
          </ul>
        </section>
        <section className="rounded-lg border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-950">Session controls</h3>
          <p className="mt-2 text-sm text-slate-600">
            {item.session ? `Session ${stateLabel(item.session.state)} · expires ${new Date(item.session.expiresAt).toLocaleString('ru-RU')}` : 'No waiting room session yet.'}
          </p>
          <div className="mt-4 grid gap-2">
            <button
              type="button"
              disabled={busy || !canStartSession}
              onClick={onStartSession}
              className="min-h-11 rounded-md bg-blue-700 px-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              Start waiting room
            </button>
            <button
              type="button"
              disabled={busy || !canConnectDoctor}
              onClick={onConnectDoctor}
              className="min-h-11 rounded-md bg-slate-900 px-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              Connect doctor
            </button>
          </div>
          {roomStatus ? <p role="status" className="mt-3 text-xs text-blue-700">{roomStatus}</p> : null}
          <p className="mt-3 text-xs text-slate-600">Latest event: {item.latestEvent ? `${eventLabel(item.latestEvent.eventType)} · ${new Date(item.latestEvent.createdAt).toLocaleString('ru-RU')}` : 'none'}</p>
        </section>
      </aside>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-900">{value}</p>
    </div>
  );
}
