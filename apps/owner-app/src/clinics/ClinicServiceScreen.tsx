import { useEffect, useState } from "react";
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
  clinicServiceApi,
  type ClinicServiceHandoff,
} from "./clinic-service-api";
import type { ClinicCatalogHandoff } from "./clinic-catalog-api";
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
  preferredServiceId,
  onBack,
  onContinue,
}: {
  clinic: ClinicCatalogHandoff;
  preferredServiceId?: string;
  onBack(): void;
  onContinue(value: ClinicServiceHandoff): void;
}) {
  const { session } = useSession();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= t.layout.ownerV50WideMinWidth;
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
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
  const selectedService = query.data?.services.find(
    (service) => service.serviceId === selectedServiceId,
  );
  const selectionMissing = Boolean(selectedServiceId && query.data && !selectedService);
  useEffect(() => {
    if (!selectedServiceId && preferredServiceId && query.data?.services.some((service) => service.serviceId === preferredServiceId)) {
      setSelectedServiceId(preferredServiceId);
    }
  }, [preferredServiceId, query.data?.services, selectedServiceId]);

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
      subtitle="Клиника уже выбрана. Теперь выберите услугу — затем покажем доступное время."
      onBack={onBack}
    >
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
        <>
          <View style={{ padding: desktop ? 18 : 14, borderWidth: 1, borderColor: decisionColors.border, borderRadius: 18, backgroundColor: decisionColors.surface, ...t.shadow.card }}>
            <View style={{ flex: 1, minWidth: 0, justifyContent: "center", gap: 8 }}>
              <DecisionHeading
                kicker="Выбранная клиника"
                title={query.data.name}
                detail={query.data.address}
              />
              <FactRow>
                <Fact tone="positive">Онлайн-запись</Fact>
                <Fact>{query.data.services.length} услуг</Fact>
                <Fact>Время · следующим шагом</Fact>
              </FactRow>
              {query.data.phone ? (
                <Text style={{ ...t.typography.caption, color: decisionColors.muted }}>
                  {query.data.phone}
                </Text>
              ) : null}
            </View>
          </View>

          <ResponsiveColumns
            primary={
              <DecisionPanel>
                <DecisionHeading
                  kicker="Доступные услуги"
                  title="Выберите услугу"
                  detail="Цена показана ровно в том виде, в котором её вернула клиника."
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
                              Информационная цена: {service.price.amount} {service.price.currency}
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
                      ? `${selectedService.price.amount} ${selectedService.price.currency} · информационная цена`
                      : "Выберите одну услугу слева."
                  }
                />
                <Text
                  style={{
                    ...t.typography.secondaryBody,
                    color: decisionColors.muted,
                  }}
                >
                  Клиника сохранится при возврате из выбора времени. После продолжения покажем только её опубликованные свободные интервалы.
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
