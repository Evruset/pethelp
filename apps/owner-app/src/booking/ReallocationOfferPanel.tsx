import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { ApiError } from "@/api/errors";
import { useSession } from "@/session/SessionProvider";
import {
  BodyText,
  Button,
  Card,
  ConfirmationModal,
  InlineBanner,
  InsetSection,
  StateMessage,
  StatusPill,
} from "@/ui/primitives";
import { uiTokens as t } from "@/ui/tokens";
import {
  bookingApi,
  type BookingChangeRequest,
  type BookingSnapshot,
  type ReallocationCase,
  type ReallocationOffer,
  type ReallocationSelection,
} from "./booking-api";

const randomKey = () => {
  const value = globalThis.crypto?.randomUUID?.();
  if (!value) throw new Error("SECURE_RANDOM_UNAVAILABLE");
  return value;
};
const dateTime = (offer: ReallocationOffer) =>
  new Intl.DateTimeFormat("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: offer.timezone,
  }).format(new Date(offer.startsAt));
const time = (value: string, timezone: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(value));
const price = (offer: ReallocationOffer) =>
  offer.priceAmount === null
    ? null
    : new Intl.NumberFormat("ru-RU", {
        style: "currency",
        currency: offer.priceCurrency!,
        maximumFractionDigits: 2,
      }).format(offer.priceAmount);
const distance = (meters: number | null) =>
  meters === null
    ? null
    : meters < 1000
      ? `${Math.round(meters)} м`
      : `${(meters / 1000).toFixed(1).replace(".", ",")} км`;

export function ReallocationOfferPanel({
  booking,
  request,
  onSelectionChange,
}: {
  booking: BookingSnapshot;
  request: BookingChangeRequest;
  onSelectionChange?: (selection: ReallocationSelection) => void;
}) {
  const { session } = useSession();
  const credential = session?.opaqueCredential;
  const [data, setData] = useState<ReallocationCase | null>(null),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [loading, setLoading] = useState(false),
    [failure, setFailure] = useState<
      "network" | "technical" | "ineligible" | null
    >(null),
    [saved, setSaved] = useState(false),
    [confirming, setConfirming] = useState(false),
    [accepting, setAccepting] = useState(false),
    [acceptFailure, setAcceptFailure] = useState(false);
  const mounted = useRef(true),
    inFlight = useRef(false),
    key = useRef<string | null>(null),
    acceptKey = useRef<string | null>(null);
  useEffect(
    () => () => {
      mounted.current = false;
      inFlight.current = false;
    },
    [],
  );
  const accept = useCallback(
    (value: ReallocationCase) => {
      if (
        value.bookingChangeRequestId !== request.requestId ||
        value.bookingHoldId !== booking.holdId
      )
        throw new Error("STALE_REALLOCATION_IDENTITY");
      if (!mounted.current) return;
      setData(value);
      setFailure(
        value.status === "REPLACEMENT_PENDING_CONFIRMATION" ||
          value.eligibility === "ACTIVE"
          ? null
          : "ineligible",
      );
      setSelectedId((current) =>
        current &&
        value.offers.some(
          (offer) => offer.offerId === current && offer.status === "OFFERED",
        )
          ? current
          : null,
      );
      setSaved(false);
    },
    [booking.holdId, request.requestId],
  );
  const open = useCallback(async () => {
    if (!credential || inFlight.current) return;
    try {
      key.current ??= randomKey();
    } catch {
      setFailure("technical");
      return;
    }
    inFlight.current = true;
    setLoading(true);
    setFailure(null);
    try {
      accept(
        await bookingApi.openReallocationCase(
          credential,
          request.requestId,
          key.current,
        ),
      );
    } catch (error) {
      if (!mounted.current) return;
      if (error instanceof ApiError && error.status === 422)
        setFailure("ineligible");
      else if (
        error instanceof ApiError &&
        (error.kind === "NETWORK" || error.kind === "TIMEOUT")
      )
        setFailure("network");
      else setFailure("technical");
    } finally {
      inFlight.current = false;
      if (mounted.current) setLoading(false);
    }
  }, [accept, credential, request.requestId]);
  const refresh = useCallback(async () => {
    if (!credential || !data || inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setFailure(null);
    try {
      accept(await bookingApi.readReallocationCase(credential, data.caseId));
    } catch (error) {
      if (!mounted.current) return;
      if (
        error instanceof ApiError &&
        (error.kind === "NETWORK" || error.kind === "TIMEOUT")
      )
        setFailure("network");
      else setFailure("technical");
    } finally {
      inFlight.current = false;
      if (mounted.current) setLoading(false);
    }
  }, [accept, credential, data]);
  useEffect(() => {
    if (!data) return;
    const next = data.offers
      .filter((offer) => offer.status === "OFFERED")
      .map((offer) => Date.parse(offer.expiresAt) - Date.parse(data.serverNow))
      .filter((value) => value > 0)
      .sort((a, b) => a - b)[0];
    if (next === undefined) return;
    const timer = setTimeout(
      () => {
        void refresh();
      },
      Math.min(next + 250, 2_147_000_000),
    );
    return () => clearTimeout(timer);
  }, [data, refresh]);
  const selected = data?.offers.find(
    (offer) => offer.offerId === selectedId && offer.status === "OFFERED",
  );
  const accepted = data?.acceptedOfferId
    ? data.offers.find((offer) => offer.offerId === data.acceptedOfferId)
    : undefined;
  const selection =
    selected && data
      ? {
          reallocationCaseId: data.caseId,
          caseVersion: data.version,
          offerId: selected.offerId,
          offerVersion: selected.version,
          bookingHoldId: data.bookingHoldId,
          clinicId: selected.clinicId,
          locationId: selected.locationId,
          doctorId: selected.doctorId,
          serviceId: selected.serviceId,
          slotId: selected.slotId,
          slotVersion: selected.slotVersion,
          expiresAt: selected.expiresAt,
        }
      : null;
  const save = () => {
    if (!selection || data?.eligibility !== "ACTIVE") return;
    setSaved(true);
    onSelectionChange?.(selection);
    setConfirming(true);
  };
  const submitAcceptance = async () => {
    if (!credential || !selection || accepting) return;
    try {
      acceptKey.current ??= randomKey();
    } catch {
      setAcceptFailure(true);
      return;
    }
    setAccepting(true);
    setAcceptFailure(false);
    try {
      const value = await bookingApi.acceptReallocationOffer(
        credential,
        selection,
        acceptKey.current,
      );
      accept(value);
      setSaved(true);
      setConfirming(false);
    } catch {
      try {
        const current = await bookingApi.readReallocationCase(
          credential,
          selection.reallocationCaseId,
        );
        if (
          current.status === "REPLACEMENT_PENDING_CONFIRMATION" &&
          current.acceptedOfferId === selection.offerId
        ) {
          accept(current);
          setSaved(true);
          setConfirming(false);
          setAcceptFailure(false);
        } else {
          accept({
            ...current,
            offers: current.offers.map((offer) =>
              offer.offerId === selection.offerId
                ? { ...offer, status: "INVALIDATED" }
                : offer,
            ),
          });
          setSelectedId(null);
          setConfirming(false);
          setAcceptFailure(true);
        }
      } catch {
        if (mounted.current) {
          setSelectedId(null);
          setConfirming(false);
          setAcceptFailure(true);
        }
      }
    } finally {
      if (mounted.current) setAccepting(false);
    }
  };
  if (
    !credential ||
    request.requestType !== "RESCHEDULE" ||
    !["OPEN", "PROCESSING"].includes(request.status)
  )
    return null;
  return (
    <InsetSection title="Другие варианты">
      <View style={{ padding: t.spacing.lg, gap: t.spacing.md }}>
        <InlineBanner
          title="Ваша текущая запись сохранена"
          body="Подобрали варианты, чтобы не искать заново. Ничего не изменится, пока вы отдельно не подтвердите перенос."
          tone="success"
        />
        {data?.status === "REPLACEMENT_PENDING_CONFIRMATION" &&
        data.replacementBooking ? (
          <InlineBanner
            title="Запрос на новое время создан"
            body="Клиника ещё должна подтвердить новую запись. Ваша текущая запись сохранена до следующего отдельного шага."
            tone="info"
          />
        ) : null}
        {data?.status === "CLOSED" &&
        data.replacementBooking?.status === "CONFIRMED" ? (
          <InlineBanner
            title="Новое время подтверждено"
            body={
              accepted
                ? `${dateTime(accepted)}, ${accepted.clinicName}. Новая запись подтверждена, предыдущая запись безопасно заменена.`
                : "Новая запись подтверждена, предыдущая запись безопасно заменена."
            }
            tone="success"
          />
        ) : null}
        {data?.status === "CLOSED" &&
        (data.replacementBooking?.status === "REJECTED" ||
          data.replacementBooking?.status === "EXPIRED") ? (
          <InlineBanner
            title="Новое время не подтверждено"
            body="Ваша предыдущая запись сохранена без изменений."
            tone="info"
          />
        ) : null}
        {!data && !loading && !failure ? (
          <>
            <BodyText secondary>
              Посмотрите до пяти подходящих вариантов в других клиниках. Это
              предложения, а не бронь времени.
            </BodyText>
            <Button
              label="Показать варианты"
              onPress={() => {
                void open();
              }}
            />
          </>
        ) : null}
        {loading && !data ? (
          <StateMessage
            kind="loading"
            title="Подбираем варианты…"
            body="Проверяем актуальное расписание и доступность."
          />
        ) : null}
        {failure === "network" ? (
          <StateMessage
            kind="error"
            title="Не удалось обновить варианты"
            body="Текущая запись сохранена. Проверьте соединение и повторите."
            action={
              <Button
                label="Повторить"
                onPress={() => {
                  void (data ? refresh() : open());
                }}
              />
            }
          />
        ) : null}
        {failure === "technical" ? (
          <StateMessage
            kind="error"
            title="Не удалось безопасно показать варианты"
            body="Текущая запись сохранена. Попробуйте обновить данные."
            action={
              <Button
                label="Повторить"
                onPress={() => {
                  void (data ? refresh() : open());
                }}
              />
            }
          />
        ) : null}
        {(failure === "ineligible" ||
          data?.eligibility === "BOOKING_INELIGIBLE") &&
        data?.status !== "REPLACEMENT_PENDING_CONFIRMATION" &&
        data?.status !== "CLOSED" ? (
          <StateMessage
            kind="conflict"
            title="Для этой записи варианты больше недоступны"
            body="Текущая запись не изменена. Обновите её статус, чтобы увидеть актуальные действия."
          />
        ) : null}
        {data && data.eligibility === "ACTIVE" && data.offers.length === 0 ? (
          <StateMessage
            kind="empty"
            title="Подходящих вариантов пока нет"
            body="Ваша текущая запись сохранена. Можно обновить поиск позже."
            action={
              <Button
                label="Обновить варианты"
                variant="secondary"
                onPress={() => {
                  void refresh();
                }}
              />
            }
          />
        ) : null}
        {data && data.eligibility === "ACTIVE" && data.offers.length > 0 ? (
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel="Варианты переноса"
            style={{ gap: t.spacing.md }}
          >
            {data.offers.map((offer) => {
              const active = offer.status === "OFFERED";
              const soon =
                active &&
                Date.parse(offer.expiresAt) - Date.parse(data.serverNow) <=
                  5 * 60_000;
              return (
                <Card
                  key={offer.offerId}
                  selected={selectedId === offer.offerId}
                  disabled={!active || loading}
                  onPress={() => {
                    setSelectedId(offer.offerId);
                    setSaved(false);
                  }}
                  accessibilityLabel={`${dateTime(offer)}, ${offer.clinicName}${offer.doctorName ? `, ${offer.doctorName}` : ""}`}
                >
                  <StatusPill
                    label={
                      offer.status === "EXPIRED"
                        ? "Срок варианта истёк"
                        : offer.status === "INVALIDATED"
                          ? "Вариант больше недоступен"
                          : soon
                            ? "Срок скоро истечёт"
                            : "Доступен"
                    }
                    tone={
                      offer.status === "OFFERED"
                        ? soon
                          ? "warning"
                          : "success"
                        : "critical"
                    }
                  />
                  <BodyText>
                    {dateTime(offer)} — {time(offer.endsAt, offer.timezone)}
                  </BodyText>
                  <BodyText>{offer.clinicName}</BodyText>
                  <BodyText secondary>{offer.locationAddress}</BodyText>
                  <BodyText>
                    {offer.doctorName
                      ? `${offer.doctorName} · ${offer.serviceName}`
                      : offer.serviceName}
                  </BodyText>
                  {price(offer) ? (
                    <BodyText
                      secondary
                    >{`Ориентировочная стоимость: ${price(offer)}`}</BodyText>
                  ) : null}
                  {distance(offer.distanceMeters) ? (
                    <BodyText
                      secondary
                    >{`Расстояние: ${distance(offer.distanceMeters)}`}</BodyText>
                  ) : null}
                  <BodyText secondary>
                    Подходит по услуге, специалисту и свободному времени.
                  </BodyText>
                  <BodyText secondary>
                    {active
                      ? `Предложение действует до ${time(offer.expiresAt, offer.timezone)}. Время не забронировано.`
                      : "Текущая запись остаётся без изменений. Обновите варианты."}
                  </BodyText>
                </Card>
              );
            })}
          </View>
        ) : null}
        {data && data.eligibility === "ACTIVE" && data.offers.length > 0 ? (
          <>
            <Button
              label="Продолжить с этим вариантом"
              disabled={!selected || loading}
              onPress={save}
            />
            <Button
              label={loading ? "Обновляем…" : "Обновить варианты"}
              variant="secondary"
              disabled={loading}
              onPress={() => {
                void refresh();
              }}
            />
            {saved && !confirming ? (
              <InlineBanner
                title="Вариант выбран для следующего шага"
                body="Текущая запись сохранена. Время ещё не забронировано; подтверждение будет отдельным действием."
                tone="info"
              />
            ) : null}
          </>
        ) : null}
        {acceptFailure ? (
          <StateMessage
            kind="error"
            title="Не удалось создать запрос на новое время"
            body="Текущая запись сохранена. Обновите предложение или безопасно повторите команду."
            action={
              <Button
                label="Обновить варианты"
                onPress={() => {
                  void refresh();
                }}
              />
            }
          />
        ) : null}
        <ConfirmationModal
          visible={confirming}
          title="Создать запрос на новое время?"
          body="Клиника должна будет подтвердить новую запись. До этого ваша текущая запись останется сохранена."
          confirmLabel={accepting ? "Создаём запрос…" : "Создать запрос"}
          busy={accepting}
          onConfirm={() => {
            void submitAcceptance();
          }}
          onCancel={() => setConfirming(false)}
        />
      </View>
    </InsetSection>
  );
}
