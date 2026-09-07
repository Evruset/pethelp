import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pressable, Text, View } from "react-native";
import { Button, StateMessage } from "@/ui/primitives";
import { uiTokens as t } from "@/ui/tokens";
import { useSession } from "@/session/SessionProvider";
import {
  availabilityApi,
  type AvailabilityHandoff,
  type AvailabilitySlot,
} from "./availability-api";
import type { ClinicServiceHandoff } from "./clinic-service-api";
import { formatInformationalPrice } from "./ClinicServiceScreen";
import {
  ClinicDecisionLayout,
  DecisionHeading,
  DecisionPanel,
  Fact,
  FactRow,
  ResponsiveColumns,
  decisionColors,
} from "./ClinicDecisionLayout";

const dateLabel = (iso: string) => {
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
};
const shortDate = (iso: string) => {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return {
    weekday: new Intl.DateTimeFormat("ru-RU", {
      weekday: "short",
      timeZone: "UTC",
    })
      .format(date)
      .replace(".", ""),
    day: String(day).padStart(2, "0"),
  };
};

export function AvailabilityScreen({
  context,
  authorityGeneration = "component-session",
  petName,
  onBack,
  onContinue,
}: {
  context: ClinicServiceHandoff;
  authorityGeneration?: string;
  petName?: string;
  onBack(): void;
  onContinue(value: AvailabilityHandoff): void;
}) {
  const { session } = useSession();
  const [selected, setSelected] = useState<AvailabilitySlot | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
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
  const dates = useMemo(
    () => [...new Set(query.data?.slots.map((slot) => slot.localDate) ?? [])],
    [query.data?.slots],
  );
  const activeDate =
    selectedDate && dates.includes(selectedDate)
      ? selectedDate
      : (dates[0] ?? null);
  const visibleSlots =
    query.data?.slots.filter((slot) => slot.localDate === activeDate) ?? [];
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
  const choose = (slot: AvailabilitySlot) => {
    if (refreshInFlight.current) return;
    selectionGeneration.current += 1;
    setSelected(slot);
    setSelectedDate(slot.localDate);
    setStale(false);
    setRefreshFailed(false);
  };
  return (
    <ClinicDecisionLayout
      eyebrow="Запись в клинику"
      title="Выберите время"
      subtitle="Выберите удобный свободный интервал. Клиника подтвердит запись после отправки заявки."
      onBack={() => {
        operation.current += 1;
        refreshInFlight.current = false;
        onBack();
      }}
    >
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
          <DecisionPanel>
            <DecisionHeading
              kicker="Контекст записи"
              title={query.data.clinicName}
              detail={query.data.serviceName}
            />
            <FactRow>
              <Fact tone="positive">Свободные слоты</Fact>
              <Fact>Время указано местное для клиники</Fact>
            </FactRow>
            <View style={{ gap: 10 }} accessibilityLabel="Контекст выбранной записи">
              {petName ? <SummaryFact label="Питомец" value={petName} /> : null}
              <SummaryFact label="Клиника" value={query.data.clinicName} />
              <SummaryFact label="Услуга" value={query.data.serviceName} />
              <SummaryFact label="Стоимость приёма" value={formatInformationalPrice(query.data.informationalPrice.amount, query.data.informationalPrice.currency)} />
              <SummaryFact label="Дата и время" value={selected && current ? `${dateLabel(selected.localDate)} в ${selected.localTime}` : "Выберите свободное время"} />
            </View>
          </DecisionPanel>
          {query.data.slots.length === 0 ? (
            <StateMessage
              kind="empty"
              title="На ближайшие 14 дней свободного времени нет"
              body="Клиника не передала доступных интервалов в текущем горизонте."
            />
          ) : (
            <ResponsiveColumns
              primary={
                <DecisionPanel>
                  <DecisionHeading
                    kicker="Дата"
                    title="Доступное время"
                    detail="Выберите дату, затем удобное время."
                  />
                  <View
                    accessibilityRole="tablist"
                    accessibilityLabel="Даты с доступным временем"
                    style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                  >
                    {dates.map((date) => {
                      const label = shortDate(date),
                        active = date === activeDate;
                      return (
                        <Pressable
                          key={date}
                          accessibilityRole="tab"
                          accessibilityState={{ selected: active }}
                          onPress={() => {
                            setSelectedDate(date);
                            if (selected?.localDate !== date) setSelected(null);
                          }}
                          style={({ pressed }) => ({
                            minWidth: 64,
                            minHeight: 58,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 14,
                            borderWidth: active ? 2 : 1,
                            borderColor: active
                              ? decisionColors.blue
                              : decisionColors.border,
                            backgroundColor: active
                              ? decisionColors.blueSoft
                              : decisionColors.soft,
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: pressed ? 0.72 : 1,
                          })}
                        >
                          <Text
                            style={{
                              ...t.typography.caption,
                              color: decisionColors.muted,
                              textTransform: "capitalize",
                            }}
                          >
                            {label.weekday}
                          </Text>
                          <Text
                            style={{
                              fontSize: 18,
                              fontWeight: "800",
                              color: decisionColors.ink,
                            }}
                          >
                            {label.day}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <View
                    accessibilityRole="radiogroup"
                    accessibilityLabel="Выбор доступного времени"
                    style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}
                  >
                    {visibleSlots.map((slot) => {
                      const active =
                        slot.slotId === selected?.slotId &&
                        slot.expectedVersion === selected.expectedVersion;
                      return (
                        <Pressable
                          key={slot.slotId}
                          accessibilityRole="radio"
                          accessibilityState={{
                            selected: active,
                            disabled: refreshing,
                          }}
                          disabled={refreshing}
                          onPress={() => choose(slot)}
                          style={({ pressed }) => ({
                            minWidth: 88,
                            minHeight: 52,
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                            borderRadius: 14,
                            borderWidth: active ? 2 : 1,
                            borderColor: active
                              ? decisionColors.blue
                              : decisionColors.border,
                            backgroundColor: active
                              ? decisionColors.blueSoft
                              : decisionColors.surface,
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: refreshing ? 0.5 : pressed ? 0.7 : 1,
                          })}
                        >
                          <Text
                            style={{
                              fontSize: 17,
                              fontWeight: "700",
                              color: decisionColors.ink,
                            }}
                          >
                            {slot.localTime}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </DecisionPanel>
              }
              secondary={
                <DecisionPanel>
                  <DecisionHeading
                    kicker="Ваш выбор"
                    title={
                      selected && current
                        ? `${dateLabel(selected.localDate)} · ${selected.localTime}`
                        : "Время не выбрано"
                    }
                    detail={
                      selected && current
                        ? `${query.data.clinicName} · ${query.data.serviceName}`
                        : "Выберите доступный интервал."
                    }
                  />
                  {selected && current ? (
                    <Text
                      accessibilityRole="text"
                      style={{
                        ...t.typography.body,
                        fontWeight: "700",
                        color: decisionColors.ink,
                      }}
                    >
                      Выбрано: {dateLabel(selected.localDate)} в{" "}
                      {selected.localTime}
                    </Text>
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
                    disabled={
                      !selected || !current || refreshing || query.isError
                    }
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
                </DecisionPanel>
              }
            />
          )}
        </>
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
    </ClinicDecisionLayout>
  );
}

function SummaryFact({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ ...t.typography.caption, color: decisionColors.muted }}>{label}</Text>
      <Text style={{ ...t.typography.body, fontWeight: "700", color: decisionColors.ink }}>{value}</Text>
    </View>
  );
}
