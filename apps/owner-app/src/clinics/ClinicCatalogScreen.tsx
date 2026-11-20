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
  DecisionPanel,
  decisionColors,
} from "./ClinicDecisionLayout";

export type ClinicCatalogMode = "browse" | "booking" | "time";
const modeCopy: Record<
  ClinicCatalogMode,
  { eyebrow: string; title: string; subtitle: string }
> = {
  browse: {
    eyebrow: "Клиники",
    title: "Клиники VetHelp",
    subtitle:
      "Найдите клинику по названию или адресу. Питомца можно выбрать при записи.",
  },
  booking: {
    eyebrow: "Подбор клиники",
    title: "Выберите клинику",
    subtitle: "Найдите подходящую клинику по названию или адресу.",
  },
  time: {
    eyebrow: "Поиск времени",
    title: "Выберите клинику",
    subtitle:
      "Выберите клинику и услугу, чтобы посмотреть доступное время.",
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
        <Text style={{ ...t.typography.caption, color: decisionColors.muted }}>
          Услуги, ориентировочная стоимость и доступное время — на следующих шагах.
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
          title={submittedSearch ? "Ничего не найдено" : "Сейчас нет клиник для онлайн-записи"}
          body={submittedSearch ? "Проверьте название клиники или адрес." : "Попробуйте обновить список позже."}
          action={submittedSearch ? (
            <Button label="Показать все клиники" variant="secondary" onPress={() => {
              setSearchInput("");
              setSubmittedSearch("");
            }} />
          ) : undefined}
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
                </View>

                <View
                  style={{
                    marginTop: "auto",
                    width: desktop ? 190 : "100%",
                    justifyContent: "flex-end",
                  }}
                >
                  <Button
                    label={mode === "browse" ? "Посмотреть услуги" : "Выбрать услугу"}
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
