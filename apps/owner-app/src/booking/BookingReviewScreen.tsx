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
import { activeBookingStore } from './active-booking-store';
import { bookingApi, type BookingResult } from './booking-api';

const randomKey = () => {
  const value = globalThis.crypto?.randomUUID?.();
  if (!value) throw new Error('SECURE_RANDOM_UNAVAILABLE');
  return value;
};
const formatDate = (value: string) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
const formatPrice = (amount: string, currency: string) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(amount));

export function BookingReviewScreen({ petId, context, authorityGeneration, onBack, onConflict, onCreated }: {
  petId: string; context: AvailabilityHandoff; authorityGeneration: string; onBack(): void; onConflict(): void; onCreated?(holdId: string): void;
}) {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const [result, setResult] = useState<BookingResult | null>(null);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<'conflict'|'identity'|'technical'|'uncertain'|null>(null);
  const [persistenceFailed, setPersistenceFailed] = useState(false);
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

  const persistCreated = async (created: BookingResult) => {
    if (!session) return;
    try {
      await activeBookingStore.write(session.cacheScope, created.holdId);
      setPersistenceFailed(false);
      onCreated?.(created.holdId);
    } catch {
      setPersistenceFailed(true);
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
        await persistCreated(created);
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

  if (result) {
    return (
      <ClinicDecisionLayout
        eyebrow="Заявка отправлена"
        title="Заявка передана в клинику"
        subtitle="Выбранные данные сохранены. Не нужно звонить в клинику и отправлять заявку повторно."
        onBack={() => {
          generation.current += 1;
          onBack();
        }}
      >
        <View
          style={{
            padding: 16,
            gap: 8,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: 'rgba(20,154,87,.22)',
            backgroundColor: decisionColors.greenSoft,
          }}
        >
          <Text style={{ ...t.typography.caption, color: decisionColors.green, fontWeight: '800', textTransform: 'uppercase' }}>
            Что дальше
          </Text>
          <Text style={{ ...t.typography.sectionTitle, color: decisionColors.ink }}>
            Ожидает подтверждения клиникой
          </Text>
          <Text style={{ ...t.typography.secondaryBody, color: decisionColors.muted }}>
            Как только клиника подтвердит или изменит статус, он обновится в VetHelp. Звонить и уточнять вручную не нужно.
          </Text>
          {persistenceFailed ? (
            <StateMessage
              kind="error"
              title="Заявка создана, но не удалось сохранить её для повторного открытия."
              action={<Button label="Повторить сохранение" onPress={() => { void persistCreated(result); }} />}
            />
          ) : null}
        </View>
      </ClinicDecisionLayout>
    );
  }

  return (
    <ClinicDecisionLayout
      eyebrow="Проверка записи"
      title="Проверьте заявку"
      subtitle="После отправки не нужно звонить и уточнять статус."
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
                detail={`${clinic!.name} · ${formatDate(slot!.localDate)} · ${slot!.localTime}`}
              />
              <View style={{ gap: 8 }}>
                <ReviewRow label="Питомец" text={pet!.name} />
                <ReviewRow label="Клиника" text={clinic!.name} />
                <ReviewRow label="Услуга" text={service!.name} />
                <ReviewRow label="Информационная цена" text={formatPrice(service!.price.amount, service!.price.currency)} />
                <ReviewRow label="Дата и время" text={`${formatDate(slot!.localDate)} · ${slot!.localTime}`} />
              </View>
              <View
                style={{
                  padding: 12,
                  gap: 4,
                  borderRadius: 14,
                  backgroundColor: decisionColors.greenSoft,
                }}
              >
                <Text style={{ ...t.typography.caption, color: decisionColors.green, fontWeight: '800' }}>
                  После отправки
                </Text>
                <Text style={{ ...t.typography.secondaryBody, color: decisionColors.ink }}>
                  Статус заявки останется в VetHelp — не придётся звонить и узнавать, приняла ли её клиника.
                </Text>
              </View>
            </DecisionPanel>
          }
          secondary={
            <DecisionPanel>
              <DecisionHeading
                kicker="Следующий шаг"
                title="Всё готово к отправке"
                detail="Отправьте заявку один раз. При перебоях связи повторная проверка не создаст дубликат."
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

function ReviewRow({ label, text }: { label: string; text: string }) {
  return (
    <View style={{ paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: decisionColors.border, gap: 2 }}>
      <Text style={{ ...t.typography.caption, color: decisionColors.muted }}>{label}</Text>
      <Text accessibilityLabel={text} style={{ ...t.typography.body, fontWeight: '700', color: decisionColors.ink }}>
        {text}
      </Text>
    </View>
  );
}
