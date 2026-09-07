import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Text, View } from "react-native";
import { BodyText, Button, Card, InsetSection, Screen, SkeletonCard, StateMessage, StatusPill } from "@/ui/primitives";
import { uiTokens as t } from "@/ui/tokens";
import { useSession } from "@/session/SessionProvider";
import {
  availabilityApi,
  type AvailabilityHandoff,
  type AvailabilitySlot,
} from "./availability-api";
import type { ClinicServiceHandoff } from "./clinic-service-api";

const dateLabel = (iso: string) => {
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
};
export function AvailabilityScreen({
  context,
  preferredSlot,
  authorityGeneration = "component-session",
  onBack,
  onContinue,
}: {
  context: ClinicServiceHandoff;
  preferredSlot?: Readonly<{slotId:string;expectedVersion:number}>;
  authorityGeneration?: string;
  onBack(): void;
  onContinue(value: AvailabilityHandoff): void;
}) {
  const { session } = useSession();
  const [selected, setSelected] = useState<AvailabilitySlot | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const operation = useRef(0);
  const refreshInFlight = useRef(false);
  const selectionGeneration = useRef(0);
  useEffect(
    () => () => {
      operation.current += 1;
      refreshInFlight.current = false;
    },
    [
      authorityGeneration,
      context.clinicId,
      context.locationId,
      context.serviceId,
    ],
  );
  const query = useQuery({
    queryKey: [
      "owner",
      session?.cacheScope,
      "session",
      authorityGeneration,
      "availability",
      context.clinicId,
      context.locationId,
      context.serviceId,
    ],
    enabled: Boolean(session),
    queryFn: ({ signal }) =>
      availabilityApi.read(session!.opaqueCredential, context, signal),
  });
  const preferredCurrent=preferredSlot?query.data?.slots.find(item=>item.slotId===preferredSlot.slotId&&item.expectedVersion===preferredSlot.expectedVersion):undefined;
  const selectedSlot=selected??preferredCurrent??null;
  const current =
    selectedSlot &&
    query.data?.slots.find(
      (slot) =>
        slot.slotId === selectedSlot.slotId &&
        slot.expectedVersion === selectedSlot.expectedVersion,
    );
  const refresh = async (forward: boolean) => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    const request = ++operation.current;
    const selectedAtStart = selectedSlot;
    const selectedGeneration = selectionGeneration.current;
    setRefreshing(true);
    setRefreshFailed(false);
    setStale(false);
    try {
      const result = await query.refetch();
      if (
        operation.current !== request ||
        selectionGeneration.current !== selectedGeneration
      )
        return;
      if (result.isError || !result.data) {
        setRefreshFailed(true);
        return;
      }
      if (selectedAtStart) {
        const authoritative = result.data.slots.find(
          (slot) =>
            slot.slotId === selectedAtStart.slotId &&
            slot.expectedVersion === selectedAtStart.expectedVersion,
        );
        if (!authoritative) {
          setSelected(null);
          setStale(true);
          return;
        }
        if (forward) {
          setRefreshing(false);
          refreshInFlight.current = false;
          onContinue({
            ...context,
            slotId: authoritative.slotId,
            expectedSlotVersion: authoritative.expectedVersion,
          });
        }
      }
    } catch {
      if (operation.current === request) setRefreshFailed(true);
    } finally {
      if (operation.current === request) setRefreshing(false);
      refreshInFlight.current = false;
    }
  };
  const groups = new Map<string, AvailabilitySlot[]>();
  if (!query.isError)
    for (const slot of query.data?.slots ?? [])
      groups.set(slot.localDate, [...(groups.get(slot.localDate) ?? []), slot]);
  return (
    <Screen title="Доступное время" subtitle="Время показано по часовому поясу клиники." backAction={onBack}>
      {query.isPending ? (
        <View style={{gap:t.spacing.md}}><StateMessage kind="loading" title="Загружаем доступное время"/><SkeletonCard/><SkeletonCard/><SkeletonCard/></View>
      ) : null}
      {query.isError ? (
        <StateMessage
          kind="error"
          title="Не удалось загрузить доступное время"
          action={
            <Button
              label="Повторить"
              onPress={() => {
                void query.refetch();
              }}
            />
          }
        />
      ) : null}
      {!query.isError && query.data ? (
        <>
          <Card><BodyText>{query.data.clinicName}</BodyText><BodyText secondary>{query.data.serviceName}</BodyText><StatusPill label="Время указано по часовому поясу клиники" tone="info" /></Card>
          {query.data.slots.length === 0 ? (
            <StateMessage
              kind="empty"
              title="На ближайшие 14 дней свободного времени нет"
            />
          ) : (
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel="Выбор доступного времени"
              style={{gap:t.spacing.lg}}
            >
              {[...groups].map(([date, slots]) => (
                <View
                  key={date}
                  accessibilityLabel={`Дата ${dateLabel(date)}`}
                  style={{ gap: t.spacing.sm }}
                >
                  <Text accessibilityRole="header" style={{ ...t.typography.sectionTitle, color:t.color.textPrimary }}>{dateLabel(date)}</Text>
                  <View style={{ flexDirection:'row', flexWrap:'wrap', gap:t.spacing.sm }}>
                    {slots.map((slot) => (
                      <Card
                        key={slot.slotId}
                        disabled={refreshing}
                        selected={
                          slot.slotId === selectedSlot?.slotId &&
                          slot.expectedVersion === selectedSlot.expectedVersion
                        }
                        onPress={() => {
                          if (refreshInFlight.current) return;
                          selectionGeneration.current += 1;
                          setSelected(slot);
                          setStale(false);
                          setRefreshFailed(false);
                        }}
                      >
                        <Text style={{ ...t.typography.body, fontWeight: "700", color:t.color.textPrimary, minWidth:62, textAlign:'center' }}>
                          {slot.localTime}
                        </Text>
                      </Card>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      ) : null}
      {selectedSlot && current ? (
        <InsetSection title="Выбрано"><View style={{padding:t.spacing.lg,gap:t.spacing.xs}}><BodyText>{dateLabel(selectedSlot.localDate)} в {selectedSlot.localTime}</BodyText><BodyText secondary>Перед продолжением ещё раз проверим доступность на сервере.</BodyText></View></InsetSection>
      ) : null}
      {stale || (selectedSlot && !current) ? (
        <StateMessage
          kind="error"
          title="Выбранное время больше недоступно. Выберите другое."
        />
      ) : null}
      {preferredSlot&&query.data&&!preferredCurrent&&!selected?<StateMessage kind="error" title="Выбранное в поиске время больше недоступно. Выберите другое."/>:null}
      {refreshFailed ? (
        <StateMessage
          kind="error"
          title="Не удалось проверить время. Повторите попытку."
        />
      ) : null}
      <Button
        label={refreshing ? "Проверяем время…" : "Продолжить"}
        disabled={!selectedSlot || !current || refreshing || query.isError}
        onPress={() => {
          void refresh(true);
        }}
      />
      <Button label={refreshing ? "Обновляем…" : "Обновить время"} variant="secondary" disabled={refreshing} onPress={() => { void refresh(false); }} />
      <Button
        label="Назад к услугам"
        variant="ghost"
        disabled={refreshing}
        onPress={() => {
          operation.current += 1;
          refreshInFlight.current = false;
          onBack();
        }}
      />
    </Screen>
  );
}
