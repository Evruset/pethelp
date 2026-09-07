import { apiClient, type ApiClient } from "@/api/client";
import type { ClinicServiceHandoff } from "./clinic-service-api";

export type AvailabilitySlot = Readonly<{
  slotId: string;
  startsAt: string;
  endsAt: string;
  localDate: string;
  localTime: string;
  expectedVersion: number;
}>;
export type AvailabilitySnapshot = Readonly<{
  observedAt: string;
  clinicName: string;
  serviceName: string;
  timezone: string;
  horizonEndsAt: string;
  informationalPrice: Readonly<{ kind: "INFORMATIONAL"; amount: string; currency: string }>;
  slots: AvailabilitySlot[];
}>;
export type AvailabilityHandoff = Readonly<
  ClinicServiceHandoff & { slotId: string; expectedSlotVersion: number }
>;
export type AvailabilityReadContext = Readonly<ClinicServiceHandoff & { doctorId?: string }>;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const exact = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).sort().join() === keys.sort().join();
const instant = (value: unknown) => {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T/.exec(value)!;
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  return (
    date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() + 1 === Number(match[2]) &&
    date.getUTCDate() === Number(match[3])
  );
};
const calendarDate = (value: unknown) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
};
const timeZone = (value: unknown): value is string => {
  if (
    typeof value !== "string" ||
    value.length > 64 ||
    !/^[A-Za-z_+-]+(?:\/[A-Za-z0-9_+-]+)+$/.test(value)
  )
    return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
};
export function parseAvailability(raw: unknown): AvailabilitySnapshot {
  if (!raw || typeof raw !== "object")
    throw new Error("INVALID_AVAILABILITY_RESPONSE");
  const value = raw as Record<string, unknown>;
  if (
    !exact(value, [
      "observedAt",
      "clinicName",
      "serviceName",
      "timezone",
      "horizonEndsAt",
      "informationalPrice",
      "slots",
    ]) ||
    !instant(value.observedAt) ||
    !instant(value.horizonEndsAt) ||
    typeof value.clinicName !== "string" ||
    typeof value.serviceName !== "string" ||
    !timeZone(value.timezone) ||
    !value.informationalPrice ||
    typeof value.informationalPrice !== "object" ||
    !Array.isArray(value.slots)
  )
    throw new Error("INVALID_AVAILABILITY_RESPONSE");
  const price = value.informationalPrice as Record<string, unknown>;
  if (!exact(price, ["kind", "amount", "currency"]) || price.kind !== "INFORMATIONAL" || typeof price.amount !== "string" || !/^\d{1,10}\.\d{2}$/.test(price.amount) || typeof price.currency !== "string" || !/^[A-Z]{3}$/.test(price.currency))
    throw new Error("INVALID_AVAILABILITY_RESPONSE");
  const slots = value.slots.map((rawSlot) => {
    if (!rawSlot || typeof rawSlot !== "object")
      throw new Error("INVALID_AVAILABILITY_RESPONSE");
    const slot = rawSlot as Record<string, unknown>;
    if (
      !exact(slot, [
        "slotId",
        "startsAt",
        "endsAt",
        "localDate",
        "localTime",
        "expectedVersion",
      ]) ||
      typeof slot.slotId !== "string" ||
      !UUID.test(slot.slotId) ||
      !instant(slot.startsAt) ||
      !instant(slot.endsAt) ||
      Date.parse(slot.endsAt as string) <=
        Date.parse(slot.startsAt as string) ||
      !calendarDate(slot.localDate) ||
      typeof slot.localTime !== "string" ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.localTime) ||
      !Number.isInteger(slot.expectedVersion) ||
      Number(slot.expectedVersion) < 1
    )
      throw new Error("INVALID_AVAILABILITY_RESPONSE");
    return slot as AvailabilitySlot;
  });
  return {
    observedAt: value.observedAt as string,
    clinicName: value.clinicName,
    serviceName: value.serviceName,
    timezone: value.timezone,
    horizonEndsAt: value.horizonEndsAt as string,
    informationalPrice: price as AvailabilitySnapshot["informationalPrice"],
    slots,
  };
}
export function createAvailabilityApi(client: ApiClient = apiClient) {
  return {
    async read(
      credential: string,
      context: AvailabilityReadContext,
      signal?: AbortSignal,
    ) {
      return parseAvailability(
        await client.request<unknown>(
          `v1/owner/clinic-catalog/${context.clinicId}/locations/${context.locationId}/services/${context.serviceId}/availability${context.doctorId ? `?doctorId=${context.doctorId}` : ""}`,
          { headers: { Authorization: `Bearer ${credential}` }, signal },
        ),
      );
    },
  };
}
export const availabilityApi = createAvailabilityApi();
