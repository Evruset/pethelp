import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Image, Pressable, Text, View } from "react-native";
import { Button, StateMessage } from "@/ui/primitives";
import { uiTokens as t } from "@/ui/tokens";
import { v50ReferenceAssets } from "@/ui/v50-reference-assets";
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
    subtitle: "Сначала сравните клиники и услуги. Питомца попросим выбрать только когда вы действительно перейдёте к записи.",
    kicker: "Посмотреть перед записью",
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
    subtitle: "Выберите клинику и услугу — на следующем шаге покажем только опубликованные доступные слоты.",
    kicker: "Фокус на доступности",
    detail: "Не показываем выдуманное «свободно сегодня»: точное время приходит из авторитетного inventory после выбора услуги.",
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
  const copy = modeCopy[mode];
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
      eyebrow={copy.eyebrow}
      title={copy.title}
      subtitle={copy.subtitle}
      onBack={onClose}
    >
      <View
        style={{
          minHeight: 154,
          borderRadius: 22,
          overflow: "hidden",
          backgroundColor: decisionColors.blueSoft,
          flexDirection: "row",
        }}
      >
        <View style={{ flex: 1, padding: 18, justifyContent: "center", gap: 6 }}>
          <Text
            style={{
              ...t.typography.caption,
              color: decisionColors.blue,
              fontWeight: "800",
              textTransform: "uppercase",
            }}
          >
            {mode === "browse" ? "Сначала посмотреть" : mode === "time" ? "Сначала выбрать место" : "Путь к записи"}
          </Text>
          <Text
            style={{
              fontSize: 22,
              lineHeight: 27,
              fontWeight: "800",
              color: decisionColors.ink,
            }}
          >
            {mode === "browse"
              ? "Клиника → услуги → время"
              : mode === "time"
                ? "Клиника → услуга → свободные слоты"
                : "Клиника → услуга → время → проверка"}
          </Text>
          <Text style={{ ...t.typography.caption, color: decisionColors.muted }}>
            Фото — визуальный референс VetHelp, не фотография конкретной клиники из каталога.
          </Text>
        </View>
        <Image
          accessibilityLabel="Визуальный референс VetHelp: посещение клиники"
          source={v50ReferenceAssets.clinicWalk}
          resizeMode="cover"
          style={{ width: 190, minHeight: 154 }}
        />
      </View>

      <DecisionPanel>
        <DecisionHeading
          kicker={copy.kicker}
          title="Клиники для онлайн-записи"
          detail={copy.detail}
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
                    {mode === "time"
                      ? "Откройте клинику и выберите услугу — после этого покажем реальное доступное время."
                      : "Откройте клинику, чтобы выбрать услугу и увидеть авторитетную цену."}
                  </Text>
                  <View style={{ minWidth: 190 }}>
                    <Button
                      label={mode === "browse" ? "Посмотреть услуги" : "Открыть клинику"}
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
