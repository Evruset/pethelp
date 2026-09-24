import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Platform,
  TextInput,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Button, StateMessage } from "@/ui/primitives";
import { uiTokens as t } from "@/ui/tokens";
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

export function ClinicCatalogScreen({
  onClose,
  onOpenClinic,
  mode = "booking",
  onHome,
  onBookings,
  onPets,
  initialSelectedLocationId,
}: {
  onClose(): void;
  onOpenClinic(clinic: ClinicCatalogHandoff): void;
  mode?: ClinicCatalogMode;
  onHome?(): void;
  onBookings?(): void;
  onPets?(): void;
  initialSelectedLocationId?: string;
}) {
  const { session } = useSession();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= 900;
  const copy = modeCopy[mode];
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(initialSelectedLocationId ?? null);
  const [searchInput, setSearchInput] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const submitSearch = () => setSubmittedSearch(searchInput.trim().replace(/\s+/g, " "));
  const query = useQuery({
    queryKey: ["owner", session?.cacheScope, "clinic-catalog", submittedSearch],
    enabled: Boolean(session),
    queryFn: ({ signal }) =>
      clinicCatalogApi.list(session!.opaqueCredential, submittedSearch, signal),
  });
  const clinics = query.data?.clinics ?? [];

  return (
    <ClinicDecisionLayout
      eyebrow={copy.eyebrow}
      title={copy.title}
      subtitle={copy.subtitle}
      onBack={onClose}
      globalNavigation={onHome && onPets ? (wide) => <OwnerGlobalNav desktop={wide} active="CLINICS" onHome={onHome} onBookings={onBookings} onPets={onPets} onClinics={() => {}} /> : undefined}
    >
      <DecisionPanel>
        <DecisionHeading
          kicker={copy.kicker}
          title="Выберите подходящий филиал"
          detail={copy.detail}
        />
        <Text style={{ ...t.typography.caption, color: decisionColors.muted }}>
          Адрес и контакт доступны в каталоге. Информационная цена и точное свободное время появятся после выбора услуги.
        </Text>
        <View accessibilityLabel="Возможности каталога" style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          <Fact tone="positive">Онлайн-запись</Fact>
          <Fact>Название или адрес</Fact>
        </View>
        <View accessibilityRole="search" style={{ flexDirection: desktop ? "row" : "column", gap: t.spacing.sm }}>
          <TextInput
            accessibilityLabel="Поиск по клинике или адресу"
            placeholder="Клиника или адрес"
            value={searchInput}
            maxLength={120}
            onChangeText={(value) => {
              setSearchInput(value);
              if (!value.trim()) setSubmittedSearch("");
            }}
            onSubmitEditing={submitSearch}
            returnKeyType="search"
            style={{ flex: 1, minHeight: 48, borderWidth: 1, borderColor: decisionColors.border, borderRadius: t.radius.control, paddingHorizontal: t.spacing.md, color: decisionColors.ink, backgroundColor: decisionColors.surface, ...t.typography.body }}
          />
          <Button label={query.isFetching && submittedSearch ? "Ищем…" : "Найти"} disabled={query.isFetching} onPress={submitSearch} />
        </View>
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
          title={submittedSearch ? "Ничего не найдено" : "Сейчас нет клиник для онлайн-записи"}
          body={submittedSearch ? "Проверьте название клиники или адрес." : "Попробуйте обновить список позже."}
        />
      ) : null}

      {!query.isError && clinics.length ? (
        <View style={{ gap: 12 }}>
          {clinics.map((clinic) => {
            const selected = selectedLocationId === clinic.locationId;
            return (
              <View
                key={clinic.locationId}
                style={{
                  width: "100%",
                  minWidth: 0,
                  padding: desktop ? 18 : 14,
                  gap: 12,
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? decisionColors.blue : decisionColors.border,
                  borderRadius: 20,
                  backgroundColor: selected ? decisionColors.blueSoft : decisionColors.surface,
                  flexDirection: desktop ? "row" : "column",
                  alignItems: "stretch",
                  ...t.shadow.card,
                }}
              >
                <View
                  style={{
                    flex: 1,
                    minWidth: 0,
                    justifyContent: "center",
                    gap: 7,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                    <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
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
                    <Text style={{ ...t.typography.caption, color: decisionColors.blue, fontWeight: "800" }}>Филиал · {clinic.address}</Text>
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
                    <View style={{ paddingHorizontal: 9, paddingVertical: 6, borderRadius: t.radius.pill, backgroundColor: decisionColors.greenSoft }}>
                      <Text style={{ ...t.typography.caption, fontSize: 11, color: decisionColors.green, fontWeight: "800" }}>Онлайн-запись</Text>
                    </View>
                  </View>

                  <FactRow>
                    <Fact>Услуги · следующий шаг</Fact>
                    <Fact>Время · после услуги</Fact>
                    <Fact>Цена · после услуги</Fact>
                  </FactRow>

                  <Text
                    style={{
                      ...t.typography.caption,
                      color: decisionColors.muted,
                    }}
                  >
                    Рейтинг, расстояние и ближайшее время не показываются: каталог пока не получает эти данные.
                  </Text>
                </View>

                <View
                  style={{
                    marginTop: "auto",
                    width: desktop ? 190 : "100%",
                    justifyContent: "flex-end",
                  }}
                >
                  <Button
                    label={mode === "browse" ? "Посмотреть услуги" : "Открыть клинику"}
                    onPress={() => {
                      setSelectedLocationId(clinic.locationId);
                      onOpenClinic({
                        clinicId: clinic.clinicId,
                        locationId: clinic.locationId,
                      })
                    }}
                  />
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </ClinicDecisionLayout>
  );
}
