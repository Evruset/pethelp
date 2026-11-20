import { useState } from "react";
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
import { BookingProgress } from "@/booking/BookingProgress";
import { BookingSelectionSummary } from "@/booking/BookingSelectionSummary";
import { formatMoney } from "@/ui/formatters";
import { useSession } from "@/session/SessionProvider";
import {
  clinicServiceApi,
  type ClinicServiceHandoff,
} from "./clinic-service-api";
import type { ClinicCatalogHandoff } from "./clinic-catalog-api";
import { doctorApi } from "./doctor-api";
import {
  ClinicDecisionLayout,
  DecisionHeading,
  DecisionPanel,
  Fact,
  FactRow,
  ResponsiveColumns,
  decisionColors,
} from "./ClinicDecisionLayout";

export function ClinicServiceScreen({
  clinic,
  petName,
  initialServiceId,
  onBack,
  onContinue,
}: {
  clinic: ClinicCatalogHandoff;
  petName?: string;
  initialServiceId?: string;
  onBack(): void;
  onContinue(value: ClinicServiceHandoff): void;
}) {
  const { session } = useSession();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= 900;
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(initialServiceId ?? null);
  const [stale, setStale] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [checking, setChecking] = useState(false);
  const query = useQuery({
    queryKey: [
      "owner",
      session?.cacheScope,
      "clinic-services",
      clinic.clinicId,
      clinic.locationId,
    ],
    enabled: Boolean(session),
    queryFn: ({ signal }) =>
      clinicServiceApi.read(
        session!.opaqueCredential,
        clinic.clinicId,
        clinic.locationId,
        signal,
      ),
  });
  const doctorsQuery = useQuery({
    queryKey: ["owner", session?.cacheScope, "clinic-doctors", clinic.clinicId, clinic.locationId],
    enabled: Boolean(session),
    queryFn: ({ signal }) => doctorApi.list(session!.opaqueCredential, clinic.clinicId, clinic.locationId, signal),
  });
  const selectedService = query.data?.services.find(
    (service) => service.serviceId === selectedServiceId,
  );
  const selectionMissing = Boolean(selectedServiceId && query.data && !selectedService);

  const proceed = async () => {
    if (!selectedServiceId || checking) return;
    setChecking(true);
    setStale(false);
    setRefreshFailed(false);
    try {
      const refreshed = await query.refetch();
      if (refreshed.isError) {
        setRefreshFailed(true);
        return;
      }
      const service = refreshed.data?.services.find(
        (item) => item.serviceId === selectedServiceId,
      );
      if (!service) {
        setSelectedServiceId(null);
        setStale(true);
        return;
      }
      onContinue({
        clinicId: clinic.clinicId,
        locationId: clinic.locationId,
        serviceId: service.serviceId,
      });
    } catch {
      setRefreshFailed(true);
    } finally {
      setChecking(false);
    }
  };

  return (
    <ClinicDecisionLayout
      eyebrow="Клиника и услуга"
      title="Что нужно питомцу?"
      subtitle="Выберите услугу, затем перейдите к доступному времени."
      onBack={onBack}
    >
      <BookingProgress current={2} />
      {query.isPending ? <StateMessage kind="loading" title="Загружаем услуги" /> : null}
      {query.isError ? (
        <StateMessage
          kind="error"
          title="Не удалось обновить карточку клиники"
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
        <DecisionPanel>
          <View
            style={{
              flexDirection: desktop ? "row" : "column",
              justifyContent: "space-between",
              alignItems: desktop ? "center" : "flex-start",
              gap: 8,
            }}
          >
            <BookingSelectionSummary
              petName={petName}
              clinicName={query.data.name}
              address={query.data.address}
              serviceName={selectedService?.name}
              price={selectedService ? formatMoney(selectedService.price.amount, selectedService.price.currency) : undefined}
            />
            <FactRow>
              <Fact tone="positive">Онлайн-запись</Fact>
              <Fact>{query.data.services.length} услуг</Fact>
            </FactRow>
          </View>
          {query.data.phone ? (
            <Text style={{ ...t.typography.secondaryBody, color: decisionColors.muted }}>
              {query.data.phone}
            </Text>
          ) : null}
          <Text
            style={{
              ...t.typography.caption,
              color: decisionColors.muted,
              fontWeight: "800",
            }}
          >
            Ветеринарные врачи
          </Text>
          {doctorsQuery.isPending ? <Text style={{ ...t.typography.secondaryBody, color: decisionColors.muted }}>Загружаем специалистов…</Text> : null}
          {doctorsQuery.data?.doctors?.map((doctor) => (
            <View key={doctor.id} style={{ padding: 12, gap: 3, borderRadius: 14, backgroundColor: decisionColors.blueSoft }}>
              <Text style={{ ...t.typography.body, color: decisionColors.ink, fontWeight: "800" }}>{doctor.displayName}</Text>
              <Text style={{ ...t.typography.caption, color: decisionColors.muted }}>{doctor.title}</Text>
              {doctor.nextAvailableAt && doctor.freshness === "CURRENT" ? <Text style={{ ...t.typography.caption, color: decisionColors.blue }}>Есть актуальное опубликованное время</Text> : null}
            </View>
          ))}
          {doctorsQuery.isError ? <Text style={{ ...t.typography.caption, color: decisionColors.muted }}>Список специалистов сейчас недоступен. Услуги филиала можно выбрать ниже.</Text> : null}
        </DecisionPanel>
      ) : null}

      {!query.isError && query.data ? (
        <>
          <ResponsiveColumns
            primary={
              <DecisionPanel>
                <DecisionHeading
                  kicker="Доступные услуги"
                  title="Выберите услугу"
                  detail="Стоимость ориентировочная. Итоговую сумму уточнит клиника."
                />
                {query.data.services.length === 0 ? (
                  <StateMessage kind="empty" title="В этой клинике пока нет доступных услуг" />
                ) : (
                  <View
                    accessibilityRole="radiogroup"
                    accessibilityLabel="Выбор услуги"
                    style={{ gap: 8 }}
                  >
                    {query.data.services.map((service) => {
                      const selected = service.serviceId === selectedServiceId;
                      return (
                        <Pressable
                          key={service.serviceId}
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                          aria-checked={selected}
                          onPress={() => {
                            setSelectedServiceId(service.serviceId);
                            setStale(false);
                          }}
                          style={({ pressed }) => ({
                            minHeight: 66,
                            paddingHorizontal: 13,
                            paddingVertical: 10,
                            borderRadius: 14,
                            borderWidth: selected ? 2 : 1,
                            borderColor: selected ? decisionColors.blue : decisionColors.border,
                            backgroundColor: selected ? decisionColors.blueSoft : decisionColors.soft,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 10,
                            opacity: pressed ? 0.75 : 1,
                          })}
                        >
                          <View style={{ flex: 1, gap: 3 }}>
                            <Text
                              style={{
                                ...t.typography.body,
                                fontWeight: "700",
                                color: decisionColors.ink,
                              }}
                            >
                              {service.name}
                            </Text>
                            <Text
                              style={{
                                ...t.typography.caption,
                                color: decisionColors.muted,
                              }}
                            >
                              Ориентировочная стоимость: {formatMoney(service.price.amount, service.price.currency)}
                            </Text>
                          </View>
                          <View
                            accessibilityElementsHidden
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 11,
                              borderWidth: 2,
                              borderColor: selected ? decisionColors.blue : "#9AA9C0",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {selected ? (
                              <View
                                style={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: 5,
                                  backgroundColor: decisionColors.blue,
                                }}
                              />
                            ) : null}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </DecisionPanel>
            }
            secondary={
              <DecisionPanel>
                <DecisionHeading
                  kicker="Ваш выбор"
                  title={selectedService?.name ?? "Услуга не выбрана"}
                  detail={
                    selectedService
                      ? `${formatMoney(selectedService.price.amount, selectedService.price.currency)} · ориентировочная стоимость`
                      : "Выберите услугу из списка."
                  }
                />
                <Text
                  style={{
                    ...t.typography.secondaryBody,
                    color: decisionColors.muted,
                  }}
                >
                  Далее — выбор доступного времени.
                </Text>
                <Button
                  label={checking ? "Проверяем…" : "Продолжить"}
                  disabled={!selectedServiceId || selectionMissing || checking || query.isError}
                  onPress={() => {
                    void proceed();
                  }}
                />
                <Button label="Назад к каталогу" variant="ghost" onPress={onBack} />
              </DecisionPanel>
            }
          />
        </>
      ) : null}

      {stale || selectionMissing ? (
        <StateMessage
          kind="error"
          title="Выбранная услуга больше недоступна. Выберите другую."
        />
      ) : null}
      {refreshFailed ? (
        <StateMessage
          kind="error"
          title="Не удалось проверить услугу. Повторите попытку."
        />
      ) : null}
    </ClinicDecisionLayout>
  );
}
