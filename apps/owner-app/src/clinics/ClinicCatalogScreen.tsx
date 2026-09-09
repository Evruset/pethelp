import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pressable, Text, View } from "react-native";
import { Button, StateMessage } from "@/ui/primitives";
import { uiTokens as t } from "@/ui/tokens";
import { useSession } from "@/session/SessionProvider";
import {
  clinicCatalogApi,
  type ClinicCatalogHandoff,
} from "./clinic-catalog-api";
import {
  ClinicDecisionLayout,
  DecisionHeading,
  DecisionPanel,
  Fact,
  FactRow,
  decisionColors,
} from "./ClinicDecisionLayout";

export function ClinicCatalogScreen({
  onClose,
  onOpenClinic,
}: {
  onClose(): void;
  onOpenClinic(clinic: ClinicCatalogHandoff): void;
}) {
  const { session } = useSession();
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    null,
  );
  const query = useQuery({
    queryKey: ["owner", session?.cacheScope, "clinic-catalog"],
    enabled: Boolean(session),
    queryFn: ({ signal }) =>
      clinicCatalogApi.list(session!.opaqueCredential, signal),
  });
  return (
    <ClinicDecisionLayout
      eyebrow="Подбор клиники"
      title="Выберите клинику"
      subtitle="Сравните только подтверждённые сведения. Услуги, цены и свободное время появятся на следующих шагах."
      onBack={onClose}
    >
      <DecisionPanel>
        <DecisionHeading
          kicker="Решение без лишнего"
          title="Клиники для онлайн-записи"
          detail="Название, адрес и контакт берём из актуального каталога VetHelp."
        />
        <FactRow>
          <Fact tone="positive">Данные клиники</Fact>
          <Fact>Без выдуманных рейтингов</Fact>
          <Fact>Без неподтверждённого расстояния</Fact>
        </FactRow>
      </DecisionPanel>
      {query.isPending ? (
        <StateMessage kind="loading" title="Загружаем клиники" />
      ) : null}
      {query.isError ? (
        <StateMessage
          kind="error"
          title="Не удалось загрузить клиники"
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
      {!query.isError && query.data?.clinics.length === 0 ? (
        <StateMessage
          kind="empty"
          title="Сейчас нет клиник для онлайн-записи"
          body="Попробуйте обновить список позже."
        />
      ) : null}
      {!query.isError && query.data?.clinics.length ? (
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Выбор клиники"
          style={{ gap: 12 }}
        >
          {query.data.clinics.map((clinic) => {
            const selected = selectedLocationId === clinic.locationId;
            return (
              <Pressable
                key={clinic.locationId}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setSelectedLocationId(clinic.locationId)}
                style={({ pressed }) => ({
                  minHeight: 148,
                  padding: 18,
                  gap: 14,
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected
                    ? decisionColors.blue
                    : decisionColors.border,
                  borderRadius: 20,
                  backgroundColor: selected
                    ? decisionColors.blueSoft
                    : decisionColors.surface,
                  opacity: pressed ? 0.78 : 1,
                  ...t.shadow.card,
                })}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 14,
                  }}
                >
                  <View
                    accessibilityElementsHidden
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 15,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: decisionColors.blueSoft,
                    }}
                  >
                    <Text style={{ fontSize: 22, color: decisionColors.blue }}>
                      ✦
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
                    <Text
                      style={{
                        fontSize: 20,
                        lineHeight: 25,
                        fontWeight: "800",
                        color: decisionColors.ink,
                      }}
                    >
                      {clinic.name}
                    </Text>
                    <Text
                      style={{
                        ...t.typography.secondaryBody,
                        color: decisionColors.muted,
                      }}
                    >
                      {clinic.address}
                    </Text>
                    {clinic.phone ? (
                      <Text
                        style={{
                          ...t.typography.caption,
                          color: decisionColors.muted,
                        }}
                      >
                        {clinic.phone}
                      </Text>
                    ) : null}
                  </View>
                  <Fact tone="positive">Онлайн-запись</Fact>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <Text
                    style={{
                      ...t.typography.caption,
                      color: decisionColors.muted,
                      flex: 1,
                      minWidth: 180,
                    }}
                  >
                    Откройте клинику, чтобы выбрать услугу и увидеть
                    авторитетную цену.
                  </Text>
                  <View style={{ minWidth: 190 }}>
                    <Button
                      label="Открыть клинику"
                      onPress={() =>
                        onOpenClinic({
                          clinicId: clinic.clinicId,
                          locationId: clinic.locationId,
                        })
                      }
                    />
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </ClinicDecisionLayout>
  );
}
