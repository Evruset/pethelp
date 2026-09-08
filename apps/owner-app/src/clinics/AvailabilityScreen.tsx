import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Text, View } from "react-native";
import { Button, Card, Screen, StateMessage } from "@/ui/primitives";
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
  authorityGeneration = "component-session",
  onBack,
  onContinue,
}: {
  context: ClinicServiceHandoff;
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
  const current =
    selected &&
    query.data?.slots.find(
      (slot) =>
        slot.slotId === selected.slotId &&
        slot.expectedVersion === selected.expectedVersion,
    );
  const refresh = async (forward: boolean) => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    const request = ++operation.current;
    const selectedAtStart = selected;
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
    <Screen title="Доступное время">
      {query.isPending ? (
        <StateMessage kind="loading" title="Загружаем доступное время" />
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
          <Card>
            <View style={{ gap: 6 }}>
              <Text style={{ fontWeight: "700" }}>{query.data.clinicName}</Text>
              <Text>{query.data.serviceName}</Text>
              <Text>Время клиники · {query.data.timezone}</Text>
            </View>
          </Card>
          {query.data.slots.length === 0 ? (
            <StateMessage
              kind="empty"
              title="На ближайшие 14 дней свободного времени нет"
            />
          ) : (
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel="Выбор доступного времени"
            >
              {[...groups].map(([date, slots]) => (
                <View
                  key={date}
                  accessibilityLabel={`Дата ${dateLabel(date)}`}
                  style={{ gap: 10 }}
                >
                  <Text
                    accessibilityRole="header"
                    style={{ fontWeight: "700", fontSize: 18 }}
                  >
                    {dateLabel(date)}
                  </Text>
                  <View style={{ gap: 10 }}>
                    {slots.map((slot) => (
                      <Card
                        key={slot.slotId}
                        disabled={refreshing}
                        selected={
                          slot.slotId === selected?.slotId &&
                          slot.expectedVersion === selected.expectedVersion
                        }
                        onPress={() => {
                          if (refreshInFlight.current) return;
                          selectionGeneration.current += 1;
                          setSelected(slot);
                          setStale(false);
                          setRefreshFailed(false);
                        }}
                      >
                        <Text style={{ fontSize: 17, fontWeight: "600" }}>
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
      {selected && current ? (
        <Text accessibilityRole="text">
          Выбрано: {dateLabel(selected.localDate)} в {selected.localTime}
        </Text>
      ) : null}
      {stale || (selected && !current) ? (
        <StateMessage
          kind="error"
          title="Выбранное время больше недоступно. Выберите другое."
        />
      ) : null}
      {refreshFailed ? (
        <StateMessage
          kind="error"
          title="Не удалось проверить время. Повторите попытку."
        />
      ) : null}
      <Button
        label={refreshing ? "Обновляем…" : "Обновить время"}
        variant="secondary"
        disabled={refreshing}
        onPress={() => {
          void refresh(false);
        }}
      />
      <Button
        label="Продолжить"
        disabled={!selected || !current || refreshing || query.isError}
        onPress={() => {
          void refresh(true);
        }}
      />
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
