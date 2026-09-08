import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Platform, Pressable, Text, View, useWindowDimensions } from "react-native";
import type { ClinicServiceHandoff } from "@/clinics/clinic-service-api";
import { ClinicDecisionLayout, DecisionHeading, DecisionPanel, Fact, FactRow, ResponsiveColumns, decisionColors } from "@/clinics/ClinicDecisionLayout";
import { useSession } from "@/session/SessionProvider";
import { Button, SkeletonCard, StateMessage } from "@/ui/primitives";
import { uiTokens as t } from "@/ui/tokens";
import { specialistDiscoveryApi, type SpecialistDiscoveryDoctor, type SpecialistSelection } from "./specialist-discovery-api";

const doctorKey = (d: Pick<SpecialistDiscoveryDoctor, "doctorId" | "serviceId" | "clinicId" | "locationId">) => `${d.doctorId}:${d.serviceId}:${d.clinicId}:${d.locationId}`;
const initial = (name: string) => name.trim().charAt(0).toLocaleUpperCase("ru-RU") || "В";
const timeLabel = (value: string, timeZone: string) => new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(value));

export function SpecialistSelectionScreen({ context, petName, initialSelection = null, authorityGeneration = "component-session", onBack, onContinue }: Props) {
  const { width } = useWindowDimensions();
  const fourColumns = Platform.OS === "web" && width >= t.layout.ownerV50WideMinWidth;
  const { session } = useSession();
  const [selectedId, setSelectedId] = useState(initialSelection?.doctorId ?? null);
  const [stale, setStale] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);
  const operation = useRef(0);
  useEffect(() => () => { operation.current += 1; }, [authorityGeneration, context.clinicId, context.locationId, context.serviceId]);
  const query = useQuery({ queryKey: ["owner", session?.cacheScope, "session", authorityGeneration, "specialist-selection", context.clinicId, context.locationId, context.serviceId], enabled: Boolean(session), queryFn: ({ signal }) => specialistDiscoveryApi.searchByServiceId(session!.opaqueCredential, context.serviceId, signal) });
  const doctors = useMemo(() => query.data?.doctors.filter((d) => d.serviceId === context.serviceId && d.clinicId === context.clinicId && d.locationId === context.locationId) ?? [], [query.data, context.clinicId, context.locationId, context.serviceId]);
  const selected = selectedId ? doctors.find((d) => d.doctorId === selectedId) ?? null : null;
  useEffect(() => { if (!selectedId || !query.data || selected) return; let current = true; queueMicrotask(() => { if (current) { setSelectedId(null); setStale(true); } }); return () => { current = false; }; }, [query.data, selected, selectedId]);

  const proceed = async () => {
    if (!selected || checking) return;
    setChecking(true); setStale(false); setCheckFailed(false);
    const request = ++operation.current;
    try {
      const refreshed = await query.refetch();
      if (request !== operation.current) return;
      if (refreshed.isError) { setCheckFailed(true); return; }
      const doctor = refreshed.data?.doctors.find((item) => doctorKey(item) === doctorKey(selected));
      if (!doctor) { setSelectedId(null); setStale(true); return; }
      onContinue({ specialtyId: doctor.specialtyId, specialtyName: doctor.specialtyName, doctorId: doctor.doctorId, doctorName: doctor.doctorName, serviceId: doctor.serviceId, clinicId: doctor.clinicId, locationId: doctor.locationId, slots: doctor.slots });
    } catch { if (request === operation.current) setCheckFailed(true); }
    finally { if (request === operation.current) setChecking(false); }
  };

  const contextDoctor = doctors[0];
  return <ClinicDecisionLayout eyebrow="Личный кабинет владельца" title="Выберите специалиста" subtitle={[contextDoctor?.serviceName, contextDoctor?.clinicName, petName].filter(Boolean).join(" · ") || "Только специалисты, допущенные к выбранной услуге."} onBack={onBack} backLabel="К выбору услуги" v50Exact>
    <ResponsiveColumns equal primary={<DecisionPanel v50Exact>
      <DecisionHeading kicker="Шаг 2 из 3" title="Доступные терапевты" detail="Один специалист для выбранной клиники, филиала и услуги." />
      {query.isPending ? <View style={{ gap: 10 }}><StateMessage kind="loading" title="Загружаем специалистов" /><SkeletonCard /><SkeletonCard /></View> : null}
      {query.isError ? <StateMessage kind="error" title="Не удалось загрузить специалистов" body="Старые данные не используются." action={<Button label="Повторить" onPress={() => { void query.refetch(); }} />} /> : null}
      {!query.isError && query.data && doctors.length === 0 ? <StateMessage kind="empty" title="Сейчас нет доступных специалистов" body="Вернитесь к выбору услуги или повторите позже." /> : null}
      {!query.isError && doctors.length > 0 ? <View accessibilityRole="radiogroup" accessibilityLabel="Выбор специалиста" style={{ flexDirection: "row", flexWrap: "wrap", gap: fourColumns ? 12 : 10 }}>
        {doctors.map((doctor) => {
          const active = doctor.doctorId === selectedId;
          const nearest = doctor.slots[0];
          return <Pressable key={doctorKey(doctor)} accessibilityRole="radio" accessibilityState={{ selected: active, disabled: checking }} disabled={checking} onPress={() => { operation.current += 1; setSelectedId(doctor.doctorId); setStale(false); setCheckFailed(false); }} style={({ pressed }) => ({ width: fourColumns ? "23%" : "48%", minHeight: 266, padding: 10, borderWidth: active ? 2 : 1, borderColor: active ? "#1767F7" : "#D9E3F2", borderRadius: 22, backgroundColor: active ? "#EEF5FF" : decisionColors.surface, gap: 8, opacity: checking ? .55 : pressed ? .72 : 1, ...(Platform.OS === "web" ? ({ boxShadow: active ? "0 15px 34px rgba(23,103,247,0.16)" : "0 10px 26px rgba(31,55,90,0.10)" } as never) : {}) })}>
            <View accessibilityElementsHidden style={{ width: "100%", aspectRatio: .85, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: active ? "#DDEAFF" : "#EEF3FA", overflow: "hidden" }}><Text style={{ fontSize: fourColumns ? 48 : 54, lineHeight: fourColumns ? 56 : 62, fontWeight: "800", color: active ? "#1767F7" : "#64748B" }}>{initial(doctor.doctorName)}</Text></View>
            <View style={{ alignItems: "center", gap: 3 }}><Text numberOfLines={2} style={{ fontSize: 15, lineHeight: 18, fontWeight: "800", color: decisionColors.ink, textAlign: "center" }}>{doctor.doctorName}</Text><Text numberOfLines={1} style={{ ...t.typography.caption, color: decisionColors.muted, textAlign: "center" }}>{doctor.specialtyName}</Text></View>
            {nearest ? <View style={{ alignSelf: "center", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10, backgroundColor: "#E7F6EF" }}><Text style={{ fontSize: 10, lineHeight: 13, color: decisionColors.green, textAlign: "center" }}>Ближайшее: {timeLabel(nearest.startsAt, doctor.timezone)}</Text></View> : null}
            <View accessibilityElementsHidden style={{ position: "absolute", top: 18, right: 18, width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: active ? "#1767F7" : "#FFFFFF", backgroundColor: active ? "#1767F7" : "rgba(255,255,255,0.88)", alignItems: "center", justifyContent: "center" }}>{active ? <Text style={{ color: "#FFFFFF", fontSize: 14, lineHeight: 16, fontWeight: "900" }}>✓</Text> : null}</View>
          </Pressable>;
        })}
      </View> : null}
      {query.isFetching && query.data && !query.isPending ? <Text accessibilityLiveRegion="polite" style={{ ...t.typography.caption, color: decisionColors.muted }}>Обновляем список специалистов…</Text> : null}
      {stale ? <StateMessage kind="error" title="Специалист больше недоступен" body="Выбор очищен. Выберите специалиста из обновлённого списка." /> : null}
      {checkFailed ? <StateMessage kind="error" title="Не удалось проверить специалиста" body="Выбор сохранён. Проверьте соединение и повторите." /> : null}
    </DecisionPanel>} secondary={<DecisionPanel v50Exact>
      <DecisionHeading kicker="Выбранный специалист" title={selected?.doctorName ?? "Сначала выберите специалиста"} />
      {selected ? <View style={{ gap: 12 }}><FactRow><Fact>{selected.specialtyName}</Fact><Fact>{selected.serviceName}</Fact></FactRow><Text style={{ ...t.typography.secondaryBody, color: decisionColors.muted }}>{selected.clinicName} · {selected.address}</Text>{selected.slots[0] ? <View style={{ padding: 14, borderRadius: 16, backgroundColor: "#F3F8FF" }}><Text style={{ ...t.typography.label, color: decisionColors.green }}>Ближайшее опубликованное время: {timeLabel(selected.slots[0].startsAt, selected.timezone)}</Text></View> : null}</View> : <Text style={{ ...t.typography.secondaryBody, color: decisionColors.muted }}>Выберите одного специалиста, чтобы перейти к доступному времени.</Text>}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: !selected || checking || query.isError || query.isFetching }} disabled={!selected || checking || query.isError || query.isFetching} onPress={() => { void proceed(); }} style={({ pressed }) => ({ minHeight: 44, justifyContent: "center", paddingHorizontal: 18, borderRadius: 14, backgroundColor: !selected || checking || query.isError || query.isFetching ? "#DDE5EF" : pressed ? "#0D55D8" : "#1767F7" })}><Text style={{ ...t.typography.button, color: !selected || checking || query.isError || query.isFetching ? "#8090A5" : "#FFFFFF", textAlign: "center" }}>{checking ? "Проверяем…" : "Выбрать время"}</Text></Pressable>
    </DecisionPanel>} />
  </ClinicDecisionLayout>;
}

type Props = { context: ClinicServiceHandoff; petName?: string; initialSelection?: SpecialistSelection | null; authorityGeneration?: string; onBack(): void; onContinue(value: SpecialistSelection): void };
