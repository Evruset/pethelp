import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollView, Text, View } from "react-native";
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
type AvailabilityScreenProps = {
  context: ClinicServiceHandoff;
  authorityGeneration?: string;
  onBack(): void;
  onContinue(value: AvailabilityHandoff): void;
};

export function AvailabilityScreen(props: AvailabilityScreenProps) {
  const { session } = useSession();
  const { context, authorityGeneration = "component-session" } = props;
  const scopeKey = `${session?.opaqueCredential ?? ''}:${authorityGeneration}:${context.clinicId}:${context.locationId}:${context.serviceId}`;
  // A new authority scope remounts the stateful flow; no effect-time setState reset.
  return <AvailabilityContent key={scopeKey} {...props} />;
}

function AvailabilityContent({
  context,
  authorityGeneration = "component-session",
  onBack,
  onContinue,
}: AvailabilityScreenProps) {
  const { session } = useSession();
  const [chosenDate, setChosenDate] = useState<string | null>(null);
  const [selected, setSelected] = useState<AvailabilitySlot | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const scopeIdentity = `${session?.opaqueCredential ?? ''}:${authorityGeneration ?? ''}:${context.clinicId}:${context.locationId}:${context.serviceId}`;
  const latestScope = useRef(scopeIdentity);
  const operation = useRef(0);
  const refreshInFlight = useRef(false);
  const selectionGeneration = useRef(0);
  useEffect(() => () => {
    operation.current += 1;
    refreshInFlight.current = false;
  }, []);
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
    if (refreshInFlight.current || latestScope.current !== scopeIdentity) return;
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
        latestScope.current !== scopeIdentity ||
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
      if (operation.current === request) { setRefreshing(false); refreshInFlight.current = false; }
    }
  };
  const authorityRefreshing = Boolean(query.isFetching && !refreshing);
  const sortedSlots=[...(query.data?.slots??[])].sort((a,b)=>a.startsAt.localeCompare(b.startsAt));
  const groups = new Map<string, AvailabilitySlot[]>();
  if (!query.isError)
    for (const slot of sortedSlots)
      groups.set(slot.localDate, [...(groups.get(slot.localDate) ?? []), slot]);
  const visibleDate = chosenDate && groups.has(chosenDate) ? chosenDate : [...groups.keys()][0];
  return (
    <Screen title="Доступное время" step="Запись · шаг 4 из 5" backLabel="Назад к услугам" backDisabled={refreshing} onBack={() => { operation.current += 1; refreshInFlight.current = false; onBack(); }} footer={<>
      <Text style={{color:'#52655e'}}>{selected && current ? `Выбрано: ${dateLabel(selected.localDate)} в ${selected.localTime}` : 'Выберите удобные дату и время'}</Text>
      <Button label="Продолжить" disabled={!selected || !current || refreshing || authorityRefreshing || query.isError} onPress={() => { void refresh(true); }}/>
    </>}>
      {query.isPending ? (
        <StateMessage kind="loading" title="Загружаем доступное время" />
      ) : null}
      {authorityRefreshing && !query.isPending ? <StateMessage kind="loading" title="Обновляем доступное время" /> : null}
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
      {!query.isError && query.data && !authorityRefreshing ? (
        <>
          <Card>
            <View style={{ gap: 6 }}>
              <Text style={{ fontWeight: "700" }}>{query.data.clinicName}</Text>
              <Text>{query.data.serviceName}</Text>
              <Text>Время клиники · {query.data.timezone}</Text>
            </View>
          </Card>
          {query.data.slots.length>0?<Text>Ближайшее из доступных окон: {dateLabel(sortedSlots[0].localDate)} · {sortedSlots[0].localTime}</Text>:null}
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
              <ScrollView horizontal accessibilityLabel="Даты приёма" showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingVertical:8}}>
                {[...groups.keys()].map(date => <View key={date}><Card compact role="button" selected={date===visibleDate} disabled={refreshing} onPress={() => { if(refreshInFlight.current)return; selectionGeneration.current += 1; setChosenDate(date); setSelected(null); setStale(false); }}><Text style={{fontWeight:'600'}}>{dateLabel(date)}</Text></Card></View>)}
              </ScrollView>
              {[...groups].filter(([date])=>date===visibleDate).map(([date, slots]) => (
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
                  <View style={{ flexDirection:"row", flexWrap:"wrap", gap:8 }}>
                    {slots.map((slot) => (
                      <View key={slot.slotId} style={{flexBasis:"30%",flexGrow:1,maxWidth:"33%"}}><Card compact
                        disabled={refreshing}
                        selected={
                          slot.slotId === selected?.slotId &&
                          slot.expectedVersion === selected.expectedVersion
                        }
                        onPress={() => {
                          if (refreshInFlight.current || latestScope.current !== scopeIdentity) return;
                          selectionGeneration.current += 1;
                          setSelected(slot);
                          setStale(false);
                          setRefreshFailed(false);
                        }}
                      >
                        <Text style={{ fontSize: 17, fontWeight: "600", textAlign:"center" }}>
                          {slot.localTime}
                        </Text>
                      </Card></View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
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
      <Button
        label={refreshing ? "Обновляем…" : "Обновить время"}
        variant="secondary"
        disabled={refreshing}
        onPress={() => {
          void refresh(false);
        }}
      />
    </Screen>
  );
}
