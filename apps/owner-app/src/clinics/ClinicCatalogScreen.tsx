import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Image,
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Button, StateMessage } from "@/ui/primitives";
import { uiTokens as t } from "@/ui/tokens";
import { v50ReferenceAssets } from "@/ui/v50-reference-assets";
import { useSession } from "@/session/SessionProvider";
import { OwnerGlobalNav } from "@/navigation/OwnerGlobalNav";
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
      "Выберите клинику и услугу — на следующем шаге покажем только опубликованные доступные слоты.",
    kicker: "Фокус на доступности",
    detail:
      "Точное свободное время появится после выбора клиники и услуги.",
  },
};

const referenceClinicImages = [
  v50ReferenceAssets.clinicFacade,
  v50ReferenceAssets.clinicReception,
  v50ReferenceAssets.clinicExam,
] as const;

export function ClinicCatalogScreen({
  onClose,
  onOpenClinic,
  mode = "booking",
  onHome,
  onPets,
  initialSelectedLocationId,
}: {
  onClose(): void;
  onOpenClinic(clinic: ClinicCatalogHandoff): void;
  mode?: ClinicCatalogMode;
  onHome?(): void;
  onPets?(): void;
  initialSelectedLocationId?: string;
}) {
  const { session } = useSession();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= 900;
  const copy = modeCopy[mode];
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(initialSelectedLocationId ?? null);
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
      globalNavigation={onHome && onPets ? (wide) => <OwnerGlobalNav desktop={wide} active="CLINICS" onHome={onHome} onPets={onPets} onClinics={() => {}} /> : undefined}
    >
      <DecisionPanel>
        <DecisionHeading
          kicker={copy.kicker}
          title="Что проверить первым"
          detail={copy.detail}
        />
        <Text style={{ ...t.typography.caption, color: decisionColors.muted }}>
          Адрес и контакт доступны в каталоге. Информационная цена и точное свободное время появятся после выбора услуги.
        </Text>
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
          {query.data.clinics.map((clinic, index) => {
            const selected = selectedLocationId === clinic.locationId;
            const image = referenceClinicImages[index % referenceClinicImages.length];
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
                  <Image
                    accessibilityLabel="Интерьер ветеринарной клиники"
                    source={image}
                    resizeMode="cover"
                    style={{ width: "100%", height: "100%" }}
                  />
                  <View
                    style={{
                      position: "absolute",
                      left: 6,
                      bottom: 6,
                      paddingHorizontal: 7,
                      paddingVertical: 4,
                      borderRadius: 9,
                      backgroundColor: "rgba(24,37,65,.82)",
                    }}
                  >
                    <Text style={{ fontSize: 9, color: "#fff", fontWeight: "700" }}>
                      Интерьер клиники
                    </Text>
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

                  <Text
                    style={{
                      ...t.typography.caption,
                      color: decisionColors.muted,
                    }}
                  >
                    Адрес и контакт предоставлены клиникой. Изображение помогает сориентироваться и может отличаться от интерьера.
                  </Text>
                </View>

                <View
                  style={{
                    width: desktop ? 224 : "100%",
                    minHeight: 126,
                    padding: 12,
                    borderRadius: 16,
                    backgroundColor: decisionColors.greenSoft,
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <View style={{ gap: 4 }}>
                    <Text
                      style={{
                        ...t.typography.caption,
                        color: decisionColors.green,
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
                    label={mode === "browse" ? "Посмотреть услуги" : "Открыть клинику"}
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
