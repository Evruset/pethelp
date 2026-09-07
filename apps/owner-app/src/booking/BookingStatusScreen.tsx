import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { ApiError } from '@/api/errors';
import { useSession } from '@/session/SessionProvider';
import { BodyText, Button, Card, ConfirmationModal, Divider, InsetSection, Screen, StateMessage, StatusPill } from '@/ui/primitives';
import { uiTokens as t } from '@/ui/tokens';
import { bookingApi, type BookingSnapshot } from './booking-api';
import {BookingChangeRequestPanel} from './BookingChangeRequestPanel';

const POLL_MS = 15_000;
const MAX_AUTOMATIC_READS = 64;
const cancellable = (value: BookingSnapshot | null): value is BookingSnapshot => value?.canCancel === true && (value.status === 'PENDING_CONFIRMATION' || value.status === 'CONFIRMED');
const randomKey = () => {
  const value = globalThis.crypto?.randomUUID?.();
  if (!value) throw new Error('SECURE_RANDOM_UNAVAILABLE');
  return value;
};

function StatusCard({ snapshot }: { snapshot: BookingSnapshot }) {
  const date = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: snapshot.slot.timezone }).format(new Date(snapshot.slot.startsAt));
  const time = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: snapshot.slot.timezone }).format(new Date(snapshot.slot.startsAt));
  const copy = snapshot.status === 'PENDING_CONFIRMATION'
    ? { title: 'Клиника подтверждает запись', body: 'Ожидаем решение клиники.', tone: 'warning' as const, badge: 'На рассмотрении' }
    : snapshot.status === 'CONFIRMED'
      ? { title: 'Запись подтверждена', body: snapshot.safeDescription, tone: 'success' as const, badge: 'Подтверждено' }
      : snapshot.status === 'REJECTED'
        ? { title: 'Клиника не сможет принять в выбранное время', body: snapshot.safeDescription, tone: 'critical' as const, badge: 'Отклонено' }
        : snapshot.status === 'CANCELLED'
          ? { title: snapshot.statusTitle, body: snapshot.safeDescription, tone: 'neutral' as const, badge: 'Отменено' }
          : { title: 'Клиника не успела подтвердить запись', body: 'Это время больше не удерживается. Выберите другое доступное время.', tone: 'warning' as const, badge: 'Истекло' };
  return <View accessibilityRole="summary" style={{gap:t.spacing.lg}}><Card><StatusPill label={copy.badge} tone={copy.tone}/><Text accessibilityRole="header" style={{...t.typography.title,color:t.color.textPrimary}}>{copy.title}</Text><BodyText secondary>{copy.body}</BodyText></Card><InsetSection title="Детали записи"><Detail label="Клиника" value={snapshot.clinic.name}/><Divider/><Detail label="Адрес" value={snapshot.location.address}/><Divider/><Detail label="Услуга" value={snapshot.service.name}/><Divider/><Detail label="Питомец" value={snapshot.pet.name}/><Divider/><Detail label="Дата и время" value={`${date}, ${time}`}/></InsetSection></View>;
}

function Detail({label,value}:{label:string;value:string}){return <View style={{paddingHorizontal:t.spacing.lg,paddingVertical:t.spacing.md,gap:3}}><BodyText secondary>{label}</BodyText><BodyText>{value}</BodyText></View>;}

export function BookingStatusScreen({ holdId, authorityGeneration, onClose }: { holdId: string; authorityGeneration: string; onClose(): void }) {
  const { session } = useSession();
  const credential = session?.opaqueCredential;
  const [snapshot, setSnapshot] = useState<BookingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<'network'|'technical'|'malformed'|null>(null);
  const [cancelConfirmationOpen, setCancelConfirmationOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelFailure, setCancelFailure] = useState<'conflict'|'retryable'|'uncertain'|'technical'|null>(null);
  const [clockNow, setClockNow] = useState(0);
  const [snapshotReceivedAt, setSnapshotReceivedAt] = useState(0);
  const snapshotRef = useRef<BookingSnapshot | null>(null);
  const requestGeneration = useRef(0);
  const automaticReads = useRef(0);
  const inFlight = useRef(false);
  const cancellationInFlight = useRef(false);
  const cancellationKey = useRef<string | null>(null);
  const cancellationCorrelationId = useRef<string | null>(null);
  const cancellationVersion = useRef<number | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshRef = useRef<(automatic?: boolean) => Promise<void>>(async () => undefined);
  const deadlineRefreshRequested = useRef(false);

  const refresh = useCallback(async (automatic = false) => {
    if (!credential || inFlight.current || cancellationInFlight.current || (automatic && automaticReads.current >= MAX_AUTOMATIC_READS)) return;
    if (automatic) automaticReads.current += 1;
    inFlight.current = true; setFailure(null); setLoading(true);
    const request = ++requestGeneration.current;
    let continuePolling = false;
    try {
      const current = await bookingApi.read(credential, holdId);
      if (requestGeneration.current === request) {
        snapshotRef.current = current;
        setSnapshot(current);
        const receivedAt = Date.now();
        setClockNow(receivedAt);
        setSnapshotReceivedAt(receivedAt);
        deadlineRefreshRequested.current = false;
        continuePolling = current.status === 'PENDING_CONFIRMATION';
      }
    } catch (error) {
      if (requestGeneration.current !== request) return;
      if (error instanceof ApiError && (error.kind === 'NETWORK' || error.kind === 'TIMEOUT')) setFailure('network');
      else if (error instanceof Error && (error.message === 'INVALID_BOOKING_SNAPSHOT' || error.message === 'INVALID_BOOKING_REFERENCE')) setFailure('malformed');
      else setFailure('technical');
    } finally {
      inFlight.current = false;
      if (requestGeneration.current === request) {
        setLoading(false);
        if (pollTimer.current) clearTimeout(pollTimer.current);
        pollTimer.current = continuePolling && automaticReads.current < MAX_AUTOMATIC_READS
          ? setTimeout(() => { void refreshRef.current(true); }, POLL_MS)
          : null;
      }
    }
  }, [credential, holdId]);
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);

  useEffect(() => {
    if (snapshot?.status !== 'PENDING_CONFIRMATION') return;
    const timer = setInterval(() => setClockNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [snapshot?.status]);

  const authoritativeNow = snapshot ? Date.parse(snapshot.serverNow) + Math.max(0, clockNow - snapshotReceivedAt) : null;
  const deadlineMs = snapshot?.status === 'PENDING_CONFIRMATION' ? Date.parse(snapshot.expiresAt) : null;
  const remainingMs = authoritativeNow !== null && deadlineMs !== null ? Math.max(0, deadlineMs - authoritativeNow) : null;
  const remainingSeconds = Math.ceil((remainingMs ?? 0) / 1_000);
  useEffect(() => {
    if (snapshot?.status !== 'PENDING_CONFIRMATION' || remainingMs !== 0 || deadlineRefreshRequested.current) return;
    deadlineRefreshRequested.current = true;
    void refreshRef.current();
  }, [remainingMs, snapshot?.status]);

  const cancel = useCallback(async () => {
    const before = snapshotRef.current;
    if (!credential || !cancellable(before) || (before.status === 'PENDING_CONFIRMATION' && remainingMs === 0) || inFlight.current || cancellationInFlight.current) return;
    let key: string;
    let correlationId: string;
    try {
      key = cancellationKey.current ?? randomKey();
      correlationId = cancellationCorrelationId.current ?? randomKey();
    } catch {
      setCancelConfirmationOpen(false); setCancelFailure('technical'); return;
    }
    cancellationKey.current = key;
    cancellationCorrelationId.current = correlationId;
    cancellationVersion.current ??= before.aggregateVersion;
    const expectedVersion = cancellationVersion.current;
    const request = ++requestGeneration.current;
    cancellationInFlight.current = true; inFlight.current = true;
    setCancelling(true); setCancelFailure(null); setFailure(null);
    if (pollTimer.current) clearTimeout(pollTimer.current);
    pollTimer.current = null;

    const readback = async (): Promise<{ value: BookingSnapshot | null; error: unknown }> => {
      if (requestGeneration.current !== request) return { value: null, error: null };
      try {
        const value = await bookingApi.read(credential, holdId);
        if (requestGeneration.current !== request) return { value: null, error: null };
        snapshotRef.current = value; setSnapshot(value); setFailure(null);
        return { value, error: null };
      } catch (error) {
        return { value: null, error };
      }
    };

    let commandError: unknown = null;
    try {
      const result = await bookingApi.cancel(credential, holdId, expectedVersion, key, correlationId);
      if (result.slotId !== before.slotId) commandError = new Error('INVALID_BOOKING_CANCELLATION_RESPONSE');
    } catch (error) {
      commandError = error;
    }

    let authoritative = await readback();
    const uncertainTransport = commandError instanceof ApiError && (commandError.kind === 'NETWORK' || commandError.kind === 'TIMEOUT');
    let versionAdvanced = Boolean(authoritative.value && authoritative.value.aggregateVersion !== expectedVersion);
    if (requestGeneration.current === request && uncertainTransport && authoritative.value && cancellable(authoritative.value) && !versionAdvanced) {
      try {
        const result = await bookingApi.cancel(credential, holdId, expectedVersion, key, correlationId);
        commandError = result.slotId === before.slotId ? null : new Error('INVALID_BOOKING_CANCELLATION_RESPONSE');
      } catch (error) {
        commandError = error;
      }
      authoritative = await readback();
      versionAdvanced = Boolean(authoritative.value && authoritative.value.aggregateVersion !== expectedVersion);
    }

    if (requestGeneration.current === request) {
      const retryableLock = commandError instanceof ApiError && commandError.safeCode === 'SLOT_LOCKED_RETRY';
      if (authoritative.value?.status === 'CANCELLED') {
        cancellationKey.current = null; cancellationCorrelationId.current = null; cancellationVersion.current = null; setCancelFailure(null);
      } else if (authoritative.value && !cancellable(authoritative.value)) {
        cancellationKey.current = null; cancellationCorrelationId.current = null; cancellationVersion.current = null; setCancelFailure('conflict');
      } else if (retryableLock && authoritative.value && cancellable(authoritative.value) && !versionAdvanced) {
        setCancelFailure('retryable');
      } else if (versionAdvanced || (commandError instanceof ApiError && (commandError.status === 409 || commandError.status === 422))) {
        cancellationKey.current = null; cancellationCorrelationId.current = null; cancellationVersion.current = null; setCancelFailure('conflict');
      } else if (uncertainTransport || authoritative.error || commandError instanceof Error) {
        setCancelFailure(commandError instanceof ApiError && (commandError.kind === 'NETWORK' || commandError.kind === 'TIMEOUT') ? 'uncertain' : 'technical');
      } else {
        setCancelFailure('uncertain');
      }
      setCancelConfirmationOpen(false); setCancelling(false);
      if (snapshotRef.current?.status === 'PENDING_CONFIRMATION' && automaticReads.current < MAX_AUTOMATIC_READS) {
        pollTimer.current = setTimeout(() => { void refreshRef.current(true); }, POLL_MS);
      }
    }
    inFlight.current = false; cancellationInFlight.current = false;
  }, [credential, holdId, remainingMs]);

  useEffect(() => {
    requestGeneration.current += 1;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial authoritative fetch synchronizes this screen with the server.
    void refresh(true);
    return () => { requestGeneration.current += 1; inFlight.current = false; cancellationInFlight.current = false; if (pollTimer.current) clearTimeout(pollTimer.current); pollTimer.current = null; };
  }, [authorityGeneration, refresh]);

  if (!credential) return <Screen title="Сессия завершена"><StateMessage kind="error" title="Войдите снова, чтобы получить актуальный статус заявки." /><Button label="Назад" variant="ghost" onPress={onClose} /></Screen>;

  if (loading && !snapshot) return <Screen title="Статус заявки" subtitle="Показываем только актуальные данные клиники."><StateMessage kind="loading" title="Получаем актуальный статус…" body="Карточка записи появится здесь без изменения шага." /></Screen>;
  if (!snapshot) return <Screen title="Статус заявки">
    <StateMessage kind="error" title={failure === 'network' ? 'Нет связи с сервером. Проверьте подключение и повторите.' : failure === 'malformed' ? 'Не удалось безопасно прочитать статус заявки.' : 'Не удалось получить статус заявки.'} action={<Button label="Повторить" onPress={() => { void refresh(); }} />} />
    <Button label="Назад" variant="ghost" onPress={onClose} />
  </Screen>;
  const cancellationPresentationAllowed = cancellable(snapshot) && !(snapshot.status === 'PENDING_CONFIRMATION' && remainingMs === 0);
  return <Screen title="Статус заявки" subtitle="Статус и доступные действия приходят с сервера." backAction={onClose}>
    <StatusCard snapshot={snapshot} />
    {snapshot.status === 'PENDING_CONFIRMATION' ? <Card>
      <BodyText>Клиника сможет подтвердить запись до {new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: snapshot.slot.timezone }).format(new Date(snapshot.expiresAt))}.</BodyText>
      {remainingMs === 0
        ? <Text accessibilityLiveRegion="polite" style={{...t.typography.caption,color:t.color.textSecondary}}>Проверяем актуальный статус…</Text>
        : <Text style={{...t.typography.caption,color:t.color.textSecondary}}>{`Осталось ${Math.floor(remainingSeconds / 60).toString().padStart(2, '0')}:${(remainingSeconds % 60).toString().padStart(2, '0')}`}</Text>}
    </Card> : null}
    {failure ? <StateMessage kind="error" title={failure === 'network' ? 'Не удалось обновить статус. Показаны последние полученные данные.' : failure === 'malformed' ? 'Сервер вернул неизвестный формат. Показаны последние проверенные данные.' : 'Не удалось обновить статус. Показаны последние полученные данные.'} action={<Button label="Обновить" onPress={() => { void refresh(); }} />} /> : null}
    {snapshot.status === 'PENDING_CONFIRMATION' && !failure && remainingMs !== 0 ? <Text style={{...t.typography.caption,color:t.color.textSecondary}}>Статус обновляется автоматически</Text> : null}
    {snapshot.status === 'CONFIRMED' ? <BookingChangeRequestPanel booking={snapshot}/> : null}
    {snapshot.status === 'CANCELLED' ? <BookingChangeRequestPanel booking={snapshot} allowCreate={false}/> : null}
    {cancelFailure === 'conflict' ? <StateMessage kind="conflict" title="Статус записи изменился. Мы показали последние данные — проверьте их перед новой попыткой." /> : null}
    {cancelFailure === 'retryable' ? <StateMessage kind="conflict" title="Запись сейчас обновляется другой операцией. Мы проверили статус — повторите отмену." action={<Button label="Повторить отмену" onPress={() => { void cancel(); }} />} /> : null}
    {cancelFailure === 'uncertain' ? <StateMessage kind="error" title="Не удалось подтвердить результат отмены. Мы проверили статус заявки; повторная попытка будет безопасной." action={<Button label="Повторить отмену" onPress={() => { void cancel(); }} />} /> : null}
    {cancelFailure === 'technical' ? <StateMessage kind="error" title="Не удалось безопасно завершить отмену. Проверьте статус и повторите попытку." action={cancellationPresentationAllowed ? <Button label="Повторить отмену" onPress={() => { void cancel(); }} /> : undefined} /> : null}
    {cancellationPresentationAllowed ? <Button label="Отменить запись" variant="destructive" disabled={loading || cancelling} onPress={() => setCancelConfirmationOpen(true)} /> : null}
    {cancelling ? <StateMessage kind="submitting" title="Проверяем результат отмены…" /> : null}
    <Button label="Обновить статус" variant="secondary" disabled={loading} onPress={() => { void refresh(); }} />
    <Button label="Назад" variant="ghost" onPress={onClose} />
    <ConfirmationModal visible={cancelConfirmationOpen && cancellationPresentationAllowed} title="Отменить запись?" body="После отмены это время снова станет доступно для записи." confirmLabel="Отменить запись" cancelLabel="Не отменять" busy={cancelling} onConfirm={() => { void cancel(); }} onCancel={() => setCancelConfirmationOpen(false)} />
  </Screen>;
}
