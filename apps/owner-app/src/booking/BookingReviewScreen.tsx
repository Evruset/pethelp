import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Text, View } from 'react-native';
import { ApiError } from '@/api/errors';
import type { AvailabilityHandoff, AvailabilitySnapshot } from '@/clinics/availability-api';
import {
  ClinicDecisionLayout,
  DecisionHeading,
  DecisionPanel,
  Fact,
  FactRow,
  ResponsiveColumns,
  decisionColors,
} from '@/clinics/ClinicDecisionLayout';
import type { ClinicServiceSnapshot } from '@/clinics/clinic-service-api';
import type { Pet } from '@/pets/pet-api';
import { useSession } from '@/session/SessionProvider';
import { Button, StateMessage } from '@/ui/primitives';
import { uiTokens as t } from '@/ui/tokens';
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

  if (result) {
    return (
      <ClinicDecisionLayout
        eyebrow="Заявка отправлена"
        title="Ожидает подтверждения клиникой"
        subtitle="Мы уже передали выбранные данные. Звонить и создавать вторую заявку не нужно."
      >
        <DecisionPanel>
          <DecisionHeading
            kicker="Статус заявки"
            title="Ожидает подтверждения клиникой"
            detail="Это ещё не подтверждённая запись. Финальный статус приходит от клиники."
          />
          <FactRow>
            <Fact tone="positive">Заявка принята сервером</Fact>
            <Fact>Статус сервера: ожидает подтверждения</Fact>
          </FactRow>
          <Text style={{ ...t.typography.secondaryBody, color: decisionColors.muted }}>
            Это ещё не подтверждённая запись.
          </Text>
        </DecisionPanel>
      </ClinicDecisionLayout>
    );
  }

  return (
    <ClinicDecisionLayout
      eyebrow="Проверка записи"
      title="Проверьте заявку"
      subtitle="Один компактный итог перед отправкой. Выбранный слот пока не равен подтверждённой записи."
      onBack={() => {
        generation.current += 1;
        onBack();
      }}
    >
      {!complete ? (
        <StateMessage
          kind="error"
          title="Данные записи устарели. Вернитесь и выберите время заново."
          action={<Button label="Выбрать другое время" onPress={onConflict} />}
        />
      ) : (
        <ResponsiveColumns
          primary={
            <DecisionPanel>
              <DecisionHeading
                kicker="Что отправим в клинику"
                title={`${pet!.name} · ${service!.name}`}
                detail={`${clinic!.name} · ${slot!.localDate} · ${slot!.localTime}`}
              />
              <View style={{ gap: 10 }}>
                <ReviewRow label="Питомец" value={pet!.name} testText={`Питомец: ${pet!.name}`} />
                <ReviewRow label="Клиника" value={clinic!.name} testText={`Клиника: ${clinic!.name}`} />
                <ReviewRow label="Услуга" value={service!.name} testText={`Услуга: ${service!.name}`} />
                <ReviewRow
                  label="Информационная цена"
                  value={`${service!.price.amount} ${service!.price.currency}`}
                  testText={`Информационная цена: ${service!.price.amount} ${service!.price.currency}`}
                />
                <ReviewRow
                  label="Дата и время"
                  value={`${slot!.localDate} · ${slot!.localTime}`}
                  testText={`Дата и время: ${slot!.localDate} · ${slot!.localTime}`}
                />
              </View>
              <Text style={{ ...t.typography.caption, color: decisionColors.muted }}>
                После отправки появится отдельный статус ожидания. Мы не называем заявку подтверждённой раньше ответа клиники.
              </Text>
            </DecisionPanel>
          }
          secondary={
            <DecisionPanel>
              <DecisionHeading
                kicker="Следующий шаг"
                title="Отправить одну заявку"
                detail="Если ответ сервера потеряется, повторная проверка использует тот же idempotency-контекст."
              />
              {failure === 'conflict' ? (
                <StateMessage kind="error" title="Это время уже недоступно. Выберите другое." action={<Button label="Выбрать другое время" onPress={onConflict} />} />
              ) : null}
              {failure === 'identity' ? (
                <StateMessage kind="error" title="Данные заявки изменились. Вернитесь к выбору и начните отправку заново." action={<Button label="Вернуться к выбору" onPress={onBack} />} />
              ) : null}
              {failure === 'uncertain' ? <StateMessage kind="error" title="Не удалось получить ответ сервера. Безопасно проверьте заявку повторно." /> : null}
              {failure === 'technical' ? <StateMessage kind="error" title="Не удалось отправить заявку. Повторите попытку." /> : null}
              <Button
                label={sending ? 'Отправляем…' : failure === 'uncertain' ? 'Проверить заявку' : 'Отправить заявку'}
                disabled={sending || failure === 'conflict' || failure === 'identity'}
                onPress={() => { void submit(); }}
              />
              <Button
                label="Назад к времени"
                variant="ghost"
                disabled={sending}
                onPress={() => { generation.current += 1; onBack(); }}
              />
            </DecisionPanel>
          }
        />
      )}
    </ClinicDecisionLayout>
  );
}

function ReviewRow({ label, value, testText }: { label: string; value: string; testText: string }) {
  return (
    <View style={{ paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: decisionColors.border, gap: 3 }}>
      <Text style={{ ...t.typography.caption, color: decisionColors.muted }}>{label}</Text>
      <Text accessibilityLabel={testText} style={{ ...t.typography.body, fontWeight: '700', color: decisionColors.ink }}>
        {testText}
      </Text>
      <Text style={{ display: 'none' }}>{value}</Text>
    </View>
  );
}
