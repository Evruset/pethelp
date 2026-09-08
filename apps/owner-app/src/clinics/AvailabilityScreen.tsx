import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Button, StateMessage } from "@/ui/primitives";
import { uiTokens as t } from "@/ui/tokens";
import { useSession } from "@/session/SessionProvider";
import {
  availabilityApi,
  type AvailabilityHandoff,
  type AvailabilitySlot,
} from "./availability-api";
import type { ClinicServiceHandoff } from "./clinic-service-api";
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
  preferredSlot,
  allowedSlots,
  revalidateContext,
  authorityGeneration = "component-session",
  onBack,
  onContinue,
}: {
  context: ClinicServiceHandoff;
  preferredSlot?: { slotId: string; expectedVersion: number };
  allowedSlots?: readonly { slotId: string; expectedVersion: number }[];
  revalidateContext?: (slot: AvailabilitySlot) => Promise<boolean>;
  authorityGeneration?: string;
  onBack(): void;
  onContinue(value: AvailabilityHandoff): void;
}) {
  const { session } = useSession();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= t.layout.ownerV50WideMinWidth;
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
  const eligibleSlots=useMemo(()=>query.data?.slots.filter((slot)=>!allowedSlots||allowedSlots.some((allowed)=>allowed.slotId===slot.slotId&&allowed.expectedVersion===slot.expectedVersion))??[],[allowedSlots,query.data?.slots]);
  const dates = useMemo(() => [...new Set(eligibleSlots.map((slot) => slot.localDate))], [eligibleSlots]);
  const activeDate =
    selectedDate && dates.includes(selectedDate)
      ? selectedDate
      : (dates[0] ?? null);
  const visibleSlots =
    eligibleSlots.filter((slot) => slot.localDate === activeDate);
  const current =
    selected &&
    eligibleSlots.find(
      (slot) =>
        slot.slotId === selected.slotId &&
        slot.expectedVersion === selected.expectedVersion,
    );
  useEffect(() => {
    if (selected || !preferredSlot || !query.data) return;
    const preferred = eligibleSlots.find((slot) => slot.slotId === preferredSlot.slotId && slot.expectedVersion === preferredSlot.expectedVersion);
    if (preferred) {
      setSelected(preferred);
      setSelectedDate(preferred.localDate);
    }
  }, [preferredSlot, query.data, eligibleSlots, selected]);
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
            slot.expectedVersion === selectedAtStart.expectedVersion &&
            (!allowedSlots||allowedSlots.some((allowed)=>allowed.slotId===slot.slotId&&allowed.expectedVersion===slot.expectedVersion)),
        );
        if (!authoritative) {
          setSelected(null);
          setStale(true);
          return;
        }
        if (forward) {
          const contextValid = revalidateContext ? await revalidateContext(authoritative) : true;
          if (operation.current !== request || selectionGeneration.current !== selectedGeneration) return;
          if (!contextValid) {
            setSelected(null);
            setStale(true);
            return;
          }
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
      subtitle="Только свободные интервалы из актуального расписания клиники. Перед продолжением выбранный слот проверим ещё раз."
      onBack={() => {
        operation.current += 1;
        refreshInFlight.current = false;
        onBack();
      }}
    >
      <View style={{ padding: 14, gap: 8, borderRadius: 16, borderWidth: 1, borderColor: decisionColors.border, backgroundColor: decisionColors.blueSoft }}>
        <Text style={{ ...t.typography.label, color: decisionColors.blue }}>1  Выберите время   →   2  Проверьте и отправьте</Text>
        <Text style={{ ...t.typography.secondaryBody, color: decisionColors.ink }}>Выбранное время станет записью только после подтверждения клиникой.</Text>
      </View>
      {query.isPending ? <StateMessage kind="loading" title="Загружаем доступное время" /> : null}
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
            <View
              style={{
                flexDirection: desktop ? "row" : "column",
                justifyContent: "space-between",
                alignItems: desktop ? "center" : "flex-start",
                gap: 8,
              }}
            >
              <DecisionHeading
                kicker="Контекст записи"
                title={query.data.clinicName}
                detail={query.data.serviceName}
              />
              <FactRow>
                <Fact tone="positive">Свободные слоты</Fact>
                <Fact>Время клиники · {query.data.timezone}</Fact>
              </FactRow>
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
                    kicker="Дата и время"
                    title="Доступные интервалы"
                    detail="Выберите дату, затем один слот."
                  />
                  <View
                    accessibilityRole="tablist"
                    accessibilityLabel="Даты с доступным временем"
                    style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}
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
                            minWidth: 62,
                            minHeight: 52,
                            paddingHorizontal: 10,
                            paddingVertical: 7,
                            borderRadius: 13,
                            borderWidth: active ? 2 : 1,
                            borderColor: active ? decisionColors.blue : decisionColors.border,
                            backgroundColor: active ? decisionColors.blueSoft : decisionColors.soft,
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
                              fontSize: 17,
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
                    style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}
                  >
                    {visibleSlots.map((slot) => {
                      const active =
                        slot.slotId === selected?.slotId &&
                        slot.expectedVersion === selected.expectedVersion;
                      return (
                        <Pressable
                          key={slot.slotId}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: active, disabled: refreshing }}
                          disabled={refreshing}
                          onPress={() => choose(slot)}
                          style={({ pressed }) => ({
                            width: desktop ? "23.5%" : undefined,
                            minWidth: desktop ? 72 : 86,
                            minHeight: 44,
                            paddingHorizontal: 10,
                            paddingVertical: 8,
                            borderRadius: 12,
                            borderWidth: active ? 2 : 1,
                            borderColor: active ? decisionColors.blue : decisionColors.border,
                            backgroundColor: active ? decisionColors.blueSoft : decisionColors.surface,
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: refreshing ? 0.5 : pressed ? 0.7 : 1,
                          })}
                        >
                          <Text
                            style={{
                              fontSize: 16,
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
                        ? "Перед переходом ещё раз проверим, что слот свободен."
                        : "Выберите доступный интервал слева."
                    }
                  />
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
