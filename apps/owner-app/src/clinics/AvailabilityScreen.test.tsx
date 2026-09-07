import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { AvailabilityScreen } from "./AvailabilityScreen";
const C = "11111111-1111-4111-8111-111111111111",
  L = "22222222-2222-4222-8222-222222222222",
  S = "33333333-3333-4333-8333-333333333333",
  T = "44444444-4444-4444-8444-444444444444";
const context = { clinicId: C, locationId: L, serviceId: S };
const slot = {
  slotId: T,
  startsAt: "2026-08-14T08:00:00.000Z",
  endsAt: "2026-08-14T08:30:00.000Z",
  localDate: "2026-08-14",
  localTime: "11:00",
  expectedVersion: 2,
};
const data = {
  observedAt: "2026-08-13T08:00:00.000Z",
  clinicName: "Clinic",
  serviceName: "Осмотр",
  timezone: "Europe/Moscow",
  horizonEndsAt: "2026-08-27T08:00:00.000Z",
  informationalPrice: { kind: "INFORMATIONAL", amount: "1250.00", currency: "RUB" },
  slots: [slot],
};
const mockUseQuery = jest.fn();
jest.mock("@tanstack/react-query", () => ({
  useQuery: (input: unknown) => mockUseQuery(input),
}));
jest.mock("@/session/SessionProvider", () => ({
  useSession: () => ({
    session: { cacheScope: "owner-a", opaqueCredential: "token-a" },
  }),
}));
describe("AvailabilityScreen", () => {
  it("shows clinic-local time, selects exactly one and refreshes before handoff", async () => {
    const onContinue = jest.fn(),
      refetch = jest.fn().mockResolvedValue({ isError: false, data });
    mockUseQuery.mockReturnValue({
      isPending: false,
      isError: false,
      data,
      refetch,
    });
    const screen = await render(
      <AvailabilityScreen
        context={context}
        petName="Барни"
        onBack={jest.fn()}
        onContinue={onContinue}
      />,
    );
    fireEvent.press(screen.getByText("11:00"));
    expect(screen.getByText("Питомец")).toBeTruthy();
    expect(screen.getByText("Барни")).toBeTruthy();
    expect(screen.getByText("Стоимость приёма")).toBeTruthy();
    expect(screen.getByText(/1.?250 ₽/)).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByText("Выбрано: 14.08.2026 в 11:00")).toBeTruthy(),
    );
    fireEvent.press(screen.getByText("Продолжить"));
    await waitFor(() =>
      expect(onContinue).toHaveBeenCalledWith({
        ...context,
        slotId: T,
        expectedSlotVersion: 2,
      }),
    );
    await waitFor(() =>
      expect(screen.getByText("Обновить время")).toBeTruthy(),
    );
    expect(refetch).toHaveBeenCalledTimes(1);
  });
  it("clears a slot that became unavailable", async () => {
    const onContinue = jest.fn(),
      refetch = jest
        .fn()
        .mockResolvedValue({ isError: false, data: { ...data, slots: [] } });
    mockUseQuery.mockReturnValue({
      isPending: false,
      isError: false,
      data,
      refetch,
    });
    const screen = await render(
      <AvailabilityScreen
        context={context}
        onBack={jest.fn()}
        onContinue={onContinue}
      />,
    );
    fireEvent.press(screen.getByText("11:00"));
    await waitFor(() =>
      expect(screen.getByText("Выбрано: 14.08.2026 в 11:00")).toBeTruthy(),
    );
    fireEvent.press(screen.getByText("Продолжить"));
    await waitFor(() =>
      expect(
        screen.getByText("Выбранное время больше недоступно. Выберите другое."),
      ).toBeTruthy(),
    );
    await waitFor(() =>
      expect(screen.getByText("Обновить время")).toBeTruthy(),
    );
    expect(onContinue).not.toHaveBeenCalled();
  });
  it("clears a slot whose authoritative version changed", async () => {
    const onContinue = jest.fn(),
      refetch = jest.fn().mockResolvedValue({
        isError: false,
        data: { ...data, slots: [{ ...slot, expectedVersion: 3 }] },
      });
    mockUseQuery.mockReturnValue({ isPending: false, isError: false, data, refetch });
    const screen = await render(<AvailabilityScreen context={context} onBack={jest.fn()} onContinue={onContinue} />);
    fireEvent.press(screen.getByText("11:00"));
    await waitFor(() => expect(screen.getByText("Выбрано: 14.08.2026 в 11:00")).toBeTruthy());
    fireEvent.press(screen.getByText("Продолжить"));
    await waitFor(() => expect(screen.getByText("Выбранное время больше недоступно. Выберите другое.")).toBeTruthy());
    expect(onContinue).not.toHaveBeenCalled();
  });
  it("never continues on failed refresh with stale cached data", async () => {
    const onContinue = jest.fn(),
      refetch = jest.fn().mockResolvedValue({ isError: true, data });
    mockUseQuery.mockReturnValue({
      isPending: false,
      isError: false,
      data,
      refetch,
    });
    const screen = await render(
      <AvailabilityScreen
        context={context}
        onBack={jest.fn()}
        onContinue={onContinue}
      />,
    );
    fireEvent.press(screen.getByText("11:00"));
    await waitFor(() =>
      expect(screen.getByText("Выбрано: 14.08.2026 в 11:00")).toBeTruthy(),
    );
    fireEvent.press(screen.getByText("Продолжить"));
    await waitFor(() =>
      expect(
        screen.getByText("Не удалось проверить время. Повторите попытку."),
      ).toBeTruthy(),
    );
    await waitFor(() =>
      expect(screen.getByText("Обновить время")).toBeTruthy(),
    );
    expect(onContinue).not.toHaveBeenCalled();
  });
  it.each([
    [{ isPending: true, isError: false }, "Загружаем доступное время"],
    [
      { isPending: false, isError: false, data: { ...data, slots: [] } },
      "На ближайшие 14 дней свободного времени нет",
    ],
    [
      { isPending: false, isError: true, data, refetch: jest.fn() },
      "Не удалось загрузить доступное время",
    ],
  ])("renders state %# without stale content", async (state, label) => {
    mockUseQuery.mockReturnValue(state);
    const screen = await render(
      <AvailabilityScreen
        context={context}
        onBack={jest.fn()}
        onContinue={jest.fn()}
      />,
    );
    expect(screen.getByText(label)).toBeTruthy();
    if (state.isError) expect(screen.queryByText("11:00")).toBeNull();
  });
  it("single-flights Continue and ignores a late result after authority replacement", async () => {
    let resolve!: (value: unknown) => void;
    const deferred = new Promise((value) => {
      resolve = value;
    });
    const onContinue = jest.fn();
    const refetch = jest.fn().mockReturnValue(deferred);
    const second = {
      ...slot,
      slotId: "55555555-5555-4555-8555-555555555555",
      localTime: "12:00",
    };
    const both = { ...data, slots: [slot, second] };
    mockUseQuery.mockReturnValue({
      isPending: false,
      isError: false,
      data: both,
      refetch,
    });
    const screen = await render(
      <AvailabilityScreen
        authorityGeneration="session-a"
        context={context}
        onBack={jest.fn()}
        onContinue={onContinue}
      />,
    );
    fireEvent.press(screen.getByText("11:00"));
    await waitFor(() =>
      expect(screen.getByText("Выбрано: 14.08.2026 в 11:00")).toBeTruthy(),
    );
    fireEvent.press(screen.getByText("Продолжить"));
    fireEvent.press(screen.getByText("Продолжить"));
    await waitFor(() =>
      expect(
        screen
          .getAllByRole("radio")
          .every((item) => item.props.accessibilityState.disabled),
      ).toBe(true),
    );
    fireEvent.press(screen.getByText("12:00"));
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Выбрано: 14.08.2026 в 12:00")).toBeNull();
    expect(
      screen.getByLabelText("Выбор доступного времени").props.accessibilityRole,
    ).toBe("radiogroup");
    screen.rerender(
      <AvailabilityScreen
        authorityGeneration="session-b"
        context={context}
        onBack={jest.fn()}
        onContinue={onContinue}
      />,
    );
    resolve({ isError: false, data: both });
    await waitFor(() => expect(onContinue).not.toHaveBeenCalled());
  });
});
