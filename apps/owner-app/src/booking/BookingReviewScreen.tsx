import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { View } from 'react-native';
import { ApiError } from '@/api/errors';
import type { AvailabilityHandoff, AvailabilitySnapshot } from '@/clinics/availability-api';
import type { ClinicServiceSnapshot } from '@/clinics/clinic-service-api';
import type { Pet } from '@/pets/pet-api';
import { useSession } from '@/session/SessionProvider';
import { BodyText, Button, Card, Divider, InsetSection, Screen, StateMessage, StatusPill } from '@/ui/primitives';
import { uiTokens as t } from '@/ui/tokens';
import { bookingApi, type BookingResult } from './booking-api';
import { activeBookingStore } from './active-booking-store';

const randomKey = () => {
  const value = globalThis.crypto?.randomUUID?.();
  if (!value) throw new Error('SECURE_RANDOM_UNAVAILABLE');
  return value;
};

export function BookingReviewScreen({ petId, context, authorityGeneration, onBack, onConflict, onCreated }: {
  petId: string; context: AvailabilityHandoff; authorityGeneration: string; onBack(): void; onConflict(): void; onCreated?(holdId: string): void;
}) {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const [result, setResult] = useState<BookingResult | null>(null);
  const [sending, setSending] = useState(false);
  const [persisting, setPersisting] = useState(false);
  const [persistenceFailure, setPersistenceFailure] = useState(false);
  const [failure, setFailure] = useState<'conflict'|'identity'|'technical'|'uncertain'|null>(null);
  const idempotencyKey = useRef(randomKey());
  const generation = useRef(0);
  const inFlight = useRef(false);
  const persistenceInFlight = useRef(false);
  useEffect(() => () => { generation.current += 1; inFlight.current = false; }, [authorityGeneration]);

  const pets = queryClient.getQueryData<Pet[]>(['owner', session?.cacheScope, 'pets']) ?? [];
  const clinic = queryClient.getQueryData<ClinicServiceSnapshot>(['owner', session?.cacheScope, 'clinic-services', context.clinicId, context.locationId]);
  const availability = queryClient.getQueryData<AvailabilitySnapshot>(['owner', session?.cacheScope, 'session', authorityGeneration, 'availability', context.clinicId, context.locationId, context.serviceId]);
  const pet = pets.find((item) => item.petId === petId);
  const service = clinic?.services.find((item) => item.serviceId === context.serviceId);
  const slot = availability?.slots.find((item) => item.slotId === context.slotId && item.expectedVersion === context.expectedSlotVersion);
  const complete = Boolean(session && pet && clinic && service && availability && slot);
  const command = useMemo(() => ({ petId, ...context }), [context, petId]);

  const persistCreated = async (created: BookingResult, request: number) => {
    if (!session || persistenceInFlight.current) return;
    persistenceInFlight.current = true; setPersisting(true); setPersistenceFailure(false);
    try {
      await activeBookingStore.write(session.cacheScope, created.holdId);
      if (generation.current === request) onCreated?.(created.holdId);
    } catch {
      if (generation.current === request) setPersistenceFailure(true);
    } finally {
      if (generation.current === request) setPersisting(false);
      persistenceInFlight.current = false;
    }
  };

  const submit = async () => {
    if (!session || !complete || inFlight.current || result) return;
    inFlight.current = true; setSending(true); setFailure(null);
    const request = ++generation.current;
    try {
      const created = await bookingApi.create(session.opaqueCredential, command, idempotencyKey.current);
      if (generation.current === request) {
        setResult(created);
        await persistCreated(created, request);
      }
    } catch (error) {
      if (generation.current !== request) return;
      if (error instanceof ApiError && error.safeCode === 'BOOKING_STATE_CONFLICT') setFailure('conflict');
      else if (error instanceof ApiError && error.safeCode === 'IDEMPOTENCY_CONFLICT') setFailure('identity');
      else if ((error instanceof ApiError && error.status === 409) || (typeof error === 'object' && error !== null && (error as { status?: unknown }).status === 409)) setFailure('conflict');
      else if (error instanceof ApiError && (error.kind === 'TIMEOUT' || error.kind === 'NETWORK')) setFailure('uncertain');
      else setFailure('technical');
    } finally {
      if (generation.current === request) setSending(false);
      inFlight.current = false;
    }
  };

  if (result) return <Screen title="Заявка отправлена" subtitle="Клиника увидит её в очереди и примет решение.">
    <Card><View accessibilityRole="summary" style={{ gap: t.spacing.sm }}><StatusPill label="Ожидает подтверждения" tone="warning"/><BodyText>Клиника подтверждает запись</BodyText><BodyText secondary>Клиника сможет подтвердить запись до {new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date(result.expiresAt))}. Это ещё не подтверждённая запись.</BodyText></View></Card>
    {persisting ? <StateMessage kind="loading" title="Сохраняем заявку для повторного открытия…" /> : null}
    {persistenceFailure ? <StateMessage kind="error" title="Заявка создана, но не удалось сохранить её для повторного открытия." action={<Button label="Повторить сохранение" onPress={() => { void persistCreated(result, generation.current); }} />} /> : null}
    <Button label="Открыть актуальный статус" onPress={() => onCreated?.(result.holdId)} />
  </Screen>;

  return <Screen title="Проверьте заявку" subtitle="Убедитесь, что питомец, клиника и время выбраны верно." backAction={sending ? undefined : onBack}>
    {!complete ? <StateMessage kind="error" title="Данные записи устарели. Вернитесь и выберите время заново." action={<Button label="Выбрать другое время" onPress={onConflict}/>} /> : <>
      <InsetSection title="Детали записи"><SummaryRow label="Питомец" value={pet!.name}/><Divider/><SummaryRow label="Клиника" value={clinic!.name}/><Divider/><SummaryRow label="Адрес" value={clinic!.address}/><Divider/><SummaryRow label="Услуга" value={service!.name}/><Divider/><SummaryRow label="Цена" value={`${service!.price.amount} ${service!.price.currency}`} caption="Информационная"/><Divider/><SummaryRow label="Дата и время" value={`${slot!.localDate} · ${slot!.localTime}`}/></InsetSection>
      {failure === 'conflict' ? <StateMessage kind="error" title="Это время уже недоступно. Выберите другое." action={<Button label="Выбрать другое время" onPress={onConflict}/>} /> : null}
      {failure === 'identity' ? <StateMessage kind="error" title="Данные заявки изменились. Вернитесь к выбору и начните отправку заново." action={<Button label="Вернуться к выбору" onPress={onBack}/>} /> : null}
      {failure === 'uncertain' ? <StateMessage kind="error" title="Не удалось получить ответ сервера. Безопасно проверьте заявку повторно." /> : null}
      {failure === 'technical' ? <StateMessage kind="error" title="Не удалось отправить заявку. Повторите попытку." /> : null}
      <Button label={sending ? 'Отправляем…' : failure === 'uncertain' ? 'Проверить заявку' : 'Отправить заявку'} disabled={sending || failure === 'conflict' || failure === 'identity'} onPress={() => { void submit(); }} />
      <Button label="Назад к времени" variant="ghost" disabled={sending} onPress={() => { generation.current += 1; onBack(); }} />
    </>}
  </Screen>;
}

function SummaryRow({label,value,caption}:{label:string;value:string;caption?:string}){return <View style={{paddingHorizontal:t.spacing.lg,paddingVertical:t.spacing.md,gap:3}}><BodyText secondary>{label}</BodyText><BodyText>{value}</BodyText>{caption?<BodyText secondary>{caption}</BodyText>:null}</View>;}
