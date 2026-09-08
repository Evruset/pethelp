import { useQuery } from "@tanstack/react-query";
import { Pressable, Text, View } from "react-native";
import { Button, StateMessage } from "@/ui/primitives";
import { uiTokens as t } from "@/ui/tokens";
import { useSession } from "@/session/SessionProvider";
import {
  clinicCatalogApi,
  type ClinicCatalogItem,
  type ClinicCatalogHandoff,
} from "./clinic-catalog-api";
import { formatInformationalPrice } from "./ClinicServiceScreen";
import {
  ClinicDecisionLayout,
  DecisionHeading,
  DecisionPanel,
  Fact,
  FactRow,
  decisionColors,
} from "./ClinicDecisionLayout";

const clinicCalendarDate = (observedAt: string, timezone: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(observedAt));
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
};

export function formatNextAvailability(
  next: NonNullable<ClinicCatalogItem["decisionSummary"]["nextAvailability"]>,
  observedAt: string,
) {
  const today = clinicCalendarDate(observedAt, next.timezone);
  const todayDate = new Date(`${today}T00:00:00Z`);
  const targetDate = new Date(`${next.localDate}T00:00:00Z`);
  const days = Math.round((targetDate.getTime() - todayDate.getTime()) / 86_400_000);
  if (days === 0) return `Сегодня, ${next.localTime}`;
  if (days === 1) return `Завтра, ${next.localTime}`;
  const [year, month, day] = next.localDate.split("-").map(Number);
  const label = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
  return `${label}, ${next.localTime}`;
}

export function ClinicCatalogScreen({
  onClose,
  onOpenClinic,
}: {
  onClose(): void;
  onOpenClinic(clinic: ClinicCatalogHandoff): void;
}) {
  const { session } = useSession();
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
      subtitle="Показываем клиники, доступные для онлайн-записи в VetHelp."
      onBack={onClose}
    >
      <DecisionPanel>
        <DecisionHeading
          kicker="Клиники для записи"
          title="Куда записать питомца?"
          detail="Нажмите на клинику, чтобы посмотреть её услуги и стоимость."
        />
        <FactRow>
          <Fact tone="positive">Онлайн-запись</Fact>
          <Fact>Адрес и контакты</Fact>
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
          accessibilityLabel="Клиники для онлайн-записи"
          style={{ gap: 12 }}
        >
          {query.data.clinics.map((clinic) => (
            <Pressable
              key={clinic.locationId}
              accessibilityRole="button"
              accessibilityLabel={`${clinic.name}. ${clinic.address}. Открыть клинику`}
              onPress={() =>
                onOpenClinic({
                  clinicId: clinic.clinicId,
                  locationId: clinic.locationId,
                })
              }
              style={({ pressed }) => ({
                minHeight: 132,
                padding: 18,
                gap: 14,
                borderWidth: 1,
                borderColor: pressed
                  ? decisionColors.blue
                  : decisionColors.border,
                borderRadius: 20,
                backgroundColor: pressed
                  ? decisionColors.blueSoft
                  : decisionColors.surface,
                opacity: pressed ? 0.82 : 1,
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
                <Text
                  accessibilityElementsHidden
                  style={{ fontSize: 24, color: decisionColors.blue }}
                >
                  ›
                </Text>
              </View>
              <View style={{ gap: 10 }}>
                {clinic.decisionSummary.nextAvailability ? (
                  <View style={{ gap: 2 }}>
                    <Text style={{ ...t.typography.caption, color: decisionColors.muted }}>Ближайшее время</Text>
                    <Text style={{ ...t.typography.body, fontWeight: "800", color: decisionColors.ink }}>
                      {formatNextAvailability(clinic.decisionSummary.nextAvailability, query.data.observedAt)}
                    </Text>
                  </View>
                ) : null}
                <FactRow>
                  {clinic.decisionSummary.informationalPrice ? (
                    <Fact tone="positive">
                      от {formatInformationalPrice(clinic.decisionSummary.informationalPrice.amount, clinic.decisionSummary.informationalPrice.currency)}
                    </Fact>
                  ) : null}
                  {clinic.decisionSummary.confirmation.mode === "MANUAL" ? (
                    <Fact>Подтверждение клиникой</Fact>
                  ) : null}
                </FactRow>
                {clinic.decisionSummary.confirmation.mode === "MANUAL" ? (
                  <Text style={{ ...t.typography.caption, color: decisionColors.muted }}>
                    После отправки клиника подтвердит запись.
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
    </ClinicDecisionLayout>
  );
}
