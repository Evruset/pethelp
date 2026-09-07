import { createAvailabilityApi, parseAvailability } from "./availability-api";
const C = "11111111-1111-4111-8111-111111111111",
  L = "22222222-2222-4222-8222-222222222222",
  S = "33333333-3333-4333-8333-333333333333",
  T = "44444444-4444-4444-8444-444444444444";
const payload = {
  observedAt: "2026-08-13T08:00:00.000Z",
  clinicName: "Clinic",
  serviceName: "Осмотр",
  timezone: "Europe/Moscow",
  horizonEndsAt: "2026-08-27T08:00:00.000Z",
  informationalPrice: { kind: "INFORMATIONAL", amount: "1250.00", currency: "RUB" },
  slots: [
    {
      slotId: T,
      startsAt: "2026-08-14T08:00:00.000Z",
      endsAt: "2026-08-14T08:30:00.000Z",
      localDate: "2026-08-14",
      localTime: "11:00",
      expectedVersion: 2,
    },
  ],
};
describe("availability api", () => {
  it("uses exact selected context and accepts the closed projection", async () => {
    const request = jest.fn().mockResolvedValue(payload);
    await expect(
      createAvailabilityApi({ request }).read("token", {
        clinicId: C,
        locationId: L,
        serviceId: S,
      }),
    ).resolves.toEqual(payload);
    expect(request).toHaveBeenCalledWith(
      `v1/owner/clinic-catalog/${C}/locations/${L}/services/${S}/availability`,
      expect.objectContaining({ headers: { Authorization: "Bearer token" } }),
    );
  });
  it("adds only the selected doctor UUID to an availability read", async () => {
    const request = jest.fn().mockResolvedValue(payload);
    await createAvailabilityApi({ request }).read("token", {
      clinicId: C,
      locationId: L,
      serviceId: S,
      doctorId: T,
    });
    expect(request).toHaveBeenCalledWith(
      `v1/owner/clinic-catalog/${C}/locations/${L}/services/${S}/availability?doctorId=${T}`,
      expect.objectContaining({ headers: { Authorization: "Bearer token" } }),
    );
  });
  it("accepts a valid multi-segment IANA timezone", () =>
    expect(
      parseAvailability({
        ...payload,
        timezone: "America/Argentina/Buenos_Aires",
      }).timezone,
    ).toBe("America/Argentina/Buenos_Aires"));
  it.each([
    { ...payload, capacity: 1 },
    { ...payload, slots: [{ ...payload.slots[0], state: "OPEN" }] },
    { ...payload, observedAt: "2026-02-30T08:00:00Z" },
    { ...payload, slots: [{ ...payload.slots[0], localDate: "2026-02-30" }] },
    { ...payload, slots: [{ ...payload.slots[0], localTime: "25:00" }] },
    { ...payload, informationalPrice: { kind: "INFORMATIONAL", amount: "free", currency: "RUB" } },
    { ...payload, informationalPrice: { kind: "FROM", amount: "1250.00", currency: "RUB" } },
  ])("fails closed for malformed or extra payload", (value) =>
    expect(() => parseAvailability(value)).toThrow(
      "INVALID_AVAILABILITY_RESPONSE",
    ),
  );
});
