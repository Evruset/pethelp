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

export type ClinicCatalogMode = "browse" | "booking" | "time";
const modeCopy: Record<
  ClinicCatalogMode,
  { eyebrow: string; title: string; subtitle: string; kicker: string; detail: string }
> = {
  browse: {
    eyebrow: "Клиники",
    title: "Клиники VetHelp",
    subtitle:
      "Сначала сравните клиники и услуги. Питомца попросим выбрать только когда вы действительно перейдёте к записи.",
    kicker: "Сравнить перед записью",
    detail: "Название, адрес и контакт берём из актуального каталога VetHelp.",
  },
  booking: {
    eyebrow: "Подбор клиники",
    title: "Выберите клинику",
    subtitle: "Сравните подтверждённые сведения и продолжите к услуге и времени.",
    kicker: "Следующий шаг записи",
    detail: "После клиники выберите услугу, затем увидите опубликованные свободные слоты.",
  },
  time: {
    eyebrow: "Поиск времени",
    title: "Где искать ближайшее время",
    subtitle:
      "Выберите клинику и услугу — на следующем шаге покажем доступное время.",
    kicker: "Фокус на доступности",
    detail: "Сначала выберите клинику, затем услугу и подходящее время.",
  },
};

export function ClinicCatalogScreen({
  onClose,
  onOpenClinic,
  mode = "booking",
}: {
  onClose(): void;
  onOpenClinic(clinic: ClinicCatalogHandoff): void;
  mode?: ClinicCatalogMode;
}) {
  const { session } = useSession();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= t.layout.ownerV50WideMinWidth;
  const copy = modeCopy[mode];
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["owner", session?.cacheScope, "clinic-catalog"],
    enabled: Boolean(session),
    queryFn: ({ signal }) =>
      clinicCatalogApi.list(session!.opaqueCredential, signal),
  });

  return (
    <ClinicDecisionLayout
      eyebrow={copy.eyebrow}
      title={copy.title}
      subtitle={copy.subtitle}
      onBack={onClose}
    >
      <DecisionPanel>
        <DecisionHeading
          kicker={copy.kicker}
          title="Что проверить первым"
          detail={copy.detail}
        />
        <FactRow><Fact tone="positive">Онлайн-запись</Fact><Fact>Адрес и контакты</Fact><Fact>Услуги следующим шагом</Fact></FactRow>
      </DecisionPanel>

      {query.isPending ? <StateMessage kind="loading" title="Загружаем клиники" /> : null}
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
          style={{ gap: 10 }}
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
                  padding: 14,
                  gap: 14,
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? decisionColors.blue : decisionColors.border,
                  borderRadius: 20,
                  backgroundColor: selected ? decisionColors.blueSoft : decisionColors.surface,
                  opacity: pressed ? 0.8 : 1,
                  flexDirection: desktop ? "row" : "column",
                  alignItems: "stretch",
                  ...t.shadow.card,
                })}
              >
                <View
                  style={{
                    width: desktop ? 124 : "100%",
                    height: desktop ? 126 : 156,
                    borderRadius: 16,
                    overflow: "hidden",
                    backgroundColor: decisionColors.blueSoft,
                  }}
                >
                  <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <Text accessibilityElementsHidden style={{ fontSize: 36 }}>⌂</Text>
                    <Text style={{ ...t.typography.caption, color: decisionColors.muted, fontWeight: "700" }}>Фото не добавлено</Text>
                  </View>
                </View>

                <View
                  style={{
                    flex: 1,
                    minWidth: 0,
                    justifyContent: "center",
                    gap: 7,
                  }}
                >
                  <View style={{ gap: 3 }}>
                    <Text
                      style={{
                        fontSize: 18,
                        lineHeight: 22,
                        fontWeight: "800",
                        color: decisionColors.ink,
                      }}
                    >
                      {clinic.name}
                    </Text>
                    <Text
                      style={{
                        ...t.typography.caption,
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

                  <FactRow>
                    <Fact tone="positive">Онлайн-запись</Fact>
                    <Fact>Время · после услуги</Fact>
                    <Fact>Цена · после услуги</Fact>
                  </FactRow>

                </View>

                <View
                  style={{
                    width: desktop ? 224 : "100%",
                    minHeight: 126,
                    padding: 12,
                    borderRadius: 16,
                    backgroundColor: decisionColors.blueSoft,
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <View style={{ gap: 4 }}>
                    <Text
                      style={{
                        ...t.typography.caption,
                        color: decisionColors.blue,
                        fontWeight: "800",
                        textTransform: "uppercase",
                      }}
                    >
                      Почему открыть
                    </Text>
                    <Text
                      style={{
                        ...t.typography.secondaryBody,
                        color: decisionColors.ink,
                        fontWeight: "700",
                      }}
                    >
                      {mode === "time"
                        ? "Увидеть услуги и перейти к реальным свободным слотам"
                        : "Проверить услуги, цену и доступное время без звонка"}
                    </Text>
                  </View>
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
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </ClinicDecisionLayout>
  );
}
