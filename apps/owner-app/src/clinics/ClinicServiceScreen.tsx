import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pressable, Text, View } from "react-native";
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
  onBack,
  onContinue,
}: {
  clinic: ClinicCatalogHandoff;
  onBack(): void;
  onContinue(value: ClinicServiceHandoff): void;
}) {
  const { session } = useSession();
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
    null,
  );
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
  const selectionMissing = Boolean(
    selectedServiceId &&
      query.data &&
      !query.data.services.some(
        (service) => service.serviceId === selectedServiceId,
      ),
  );
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
      subtitle="Клиника уже выбрана. Выберите одну услугу — повторно вводить данные не нужно."
      onBack={onBack}
    >
      {query.isPending ? (
        <StateMessage kind="loading" title="Загружаем услуги" />
      ) : null}
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
        <ResponsiveColumns
          primary={
            <DecisionPanel>
              <DecisionHeading
                kicker="Доступные услуги"
                title="Выберите услугу"
                detail="Цена показана как информационная — ровно в том виде, в котором её вернула клиника."
              />
              {query.data.services.length === 0 ? (
                <StateMessage
                  kind="empty"
                  title="В этой клинике пока нет доступных услуг"
                />
              ) : (
                <View
                  accessibilityRole="radiogroup"
                  accessibilityLabel="Выбор услуги"
                  style={{ gap: 10 }}
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
                          minHeight: 78,
                          padding: 15,
                          borderRadius: 16,
                          borderWidth: selected ? 2 : 1,
                          borderColor: selected
                            ? decisionColors.blue
                            : decisionColors.border,
                          backgroundColor: selected
                            ? decisionColors.blueSoft
                            : decisionColors.soft,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 12,
                          opacity: pressed ? 0.75 : 1,
                        })}
                      >
                        <View style={{ flex: 1, gap: 4 }}>
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
                            Информационная цена: {service.price.amount}{" "}
                            {service.price.currency}
                          </Text>
                        </View>
                        <View
                          accessibilityElementsHidden
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 12,
                            borderWidth: 2,
                            borderColor: selected
                              ? decisionColors.blue
                              : "#9AA9C0",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {selected ? (
                            <View
                              style={{
                                width: 12,
                                height: 12,
                                borderRadius: 6,
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
                title={query.data.name}
                detail={query.data.address}
              />
              {query.data.phone ? (
                <FactRow>
                  <Fact>{query.data.phone}</Fact>
                </FactRow>
              ) : null}
              <Text
                style={{
                  ...t.typography.secondaryBody,
                  color: decisionColors.muted,
                }}
              >
                Выбранная клиника сохранится при возврате из выбора времени.
              </Text>
              <Button
                label={checking ? "Проверяем…" : "Продолжить"}
                disabled={
                  !selectedServiceId ||
                  selectionMissing ||
                  checking ||
                  query.isError
                }
                onPress={() => {
                  void proceed();
                }}
              />
              <Button
                label="Назад к каталогу"
                variant="ghost"
                onPress={onBack}
              />
            </DecisionPanel>
          }
        />
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
