import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Text, View } from 'react-native';
import { ApiError } from '@/api/errors';
import type { AvailabilityHandoff, AvailabilitySnapshot } from '@/clinics/availability-api';
import type { ClinicServiceSnapshot } from '@/clinics/clinic-service-api';
import type { Pet } from '@/pets/pet-api';
import { useSession } from '@/session/SessionProvider';
import { Button, Card, Screen, StateMessage } from '@/ui/primitives';
import { bookingApi, type BookingResult } from './booking-api';

const randomKey = () => {
  const value = globalThis.crypto?.randomUUID?.();
  if (!value) throw new Error('SECURE_RANDOM_UNAVAILABLE');
  return value;
};

export function BookingReviewScreen({ petId, context, authorityGeneration, onBack, onConflict }: {
  petId: string; context: AvailabilityHandoff; authorityGeneration: string; onBack(): void; onConflict(): void;
}) {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const [result, setResult] = useState<BookingResult | null>(null);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<'conflict'|'identity'|'technical'|'uncertain'|null>(null);
  const idempotencyKey = useRef(randomKey());
  const generation = useRef(0);
  const inFlight = useRef(false);
  useEffect(() => () => { generation.current += 1; inFlight.current = false; }, [authorityGeneration]);

  const pets = queryClient.getQueryData<Pet[]>(['owner', session?.cacheScope, 'pets']) ?? [];
  const clinic = queryClient.getQueryData<ClinicServiceSnapshot>(['owner', session?.cacheScope, 'clinic-services', context.clinicId, context.locationId]);
  const availability = queryClient.getQueryData<AvailabilitySnapshot>(['owner', session?.cacheScope, 'session', authorityGeneration, 'availability', context.clinicId, context.locationId, context.serviceId]);
  const pet = pets.find((item) => item.petId === petId);
  const service = clinic?.services.find((item) => item.serviceId === context.serviceId);
  const slot = availability?.slots.find((item) => item.slotId === context.slotId && item.expectedVersion === context.expectedSlotVersion);
  const complete = Boolean(session && pet && clinic && service && availability && slot);
  const command = useMemo(() => ({ petId, ...context }), [context, petId]);

  const submit = async () => {
    if (!session || !complete || inFlight.current || result) return;
    inFlight.current = true; setSending(true); setFailure(null);
    const request = ++generation.current;
    try {
      const created = await bookingApi.create(session.opaqueCredential, command, idempotencyKey.current);
      if (generation.current === request) setResult(created);
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

  if (result) return <Screen title="Заявка отправлена">
    <Card><View accessibilityRole="summary" style={{ gap: 6 }}><Text accessibilityRole="header">Ожидает подтверждения клиникой</Text><Text>Статус сервера: ожидает подтверждения</Text><Text>Это ещё не подтверждённая запись.</Text></View></Card>
  </Screen>;

  return <Screen title="Проверьте заявку">
    {!complete ? <StateMessage kind="error" title="Данные записи устарели. Вернитесь и выберите время заново." action={<Button label="Выбрать другое время" onPress={onConflict}/>} /> : <>
      <Card><View style={{ gap: 8 }}><Text accessibilityRole="header">Детали записи</Text><Text>Питомец: {pet!.name}</Text><Text>Клиника: {clinic!.name}</Text><Text>Услуга: {service!.name}</Text><Text>Информационная цена: {service!.price.amount} {service!.price.currency}</Text><Text>Дата и время: {slot!.localDate} · {slot!.localTime}</Text></View></Card>
      {failure === 'conflict' ? <StateMessage kind="error" title="Это время уже недоступно. Выберите другое." action={<Button label="Выбрать другое время" onPress={onConflict}/>} /> : null}
      {failure === 'identity' ? <StateMessage kind="error" title="Данные заявки изменились. Вернитесь к выбору и начните отправку заново." action={<Button label="Вернуться к выбору" onPress={onBack}/>} /> : null}
      {failure === 'uncertain' ? <StateMessage kind="error" title="Не удалось получить ответ сервера. Безопасно проверьте заявку повторно." /> : null}
      {failure === 'technical' ? <StateMessage kind="error" title="Не удалось отправить заявку. Повторите попытку." /> : null}
      <Button label={sending ? 'Отправляем…' : failure === 'uncertain' ? 'Проверить заявку' : 'Отправить заявку'} disabled={sending || failure === 'conflict' || failure === 'identity'} onPress={() => { void submit(); }} />
      <Button label="Назад к времени" variant="ghost" disabled={sending} onPress={() => { generation.current += 1; onBack(); }} />
    </>}
  </Screen>;
}
