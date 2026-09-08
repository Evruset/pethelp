import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { ApiError } from '@/api/errors';
import AuthenticatedHomeScreen from '@/app/(app)';
import PublicHomeScreen from '@/app/(public)';
import { SessionProvider, useSession } from '@/session/SessionProvider';
import type { SessionStore } from '@/session/secure-session-store';
import type { SessionAuthority } from '@/session/session-authority';
import type { AuthApi, OtpChallenge, OwnerSessionResult } from './auth-api';
import { AuthJourneyProvider, useAuthJourney } from './AuthJourneyProvider';
import { PetJourneyProvider } from '@/pets/PetJourneyProvider';

const future = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();
const CHALLENGE: OtpChallenge = { challengeId: '11111111-1111-4111-8111-111111111111', expiresAt: future(300_000), resendAvailableAt: future(-1_000) };
const NEW_CHALLENGE = { ...CHALLENGE, challengeId: '33333333-3333-4333-8333-333333333333' };
const SESSION: OwnerSessionResult = { sessionToken: `vh_${'a'.repeat(64)}`, expiresAt: future(3_600_000), owner: { id: '22222222-2222-4222-8222-222222222222' } };

function mockApi(): jest.Mocked<AuthApi> {
  return {
    requestOtp: jest.fn<ReturnType<AuthApi['requestOtp']>, Parameters<AuthApi['requestOtp']>>(async () => CHALLENGE),
    resendOtp: jest.fn<ReturnType<AuthApi['resendOtp']>, Parameters<AuthApi['resendOtp']>>(async () => NEW_CHALLENGE),
    verifyOtp: jest.fn<ReturnType<AuthApi['verifyOtp']>, Parameters<AuthApi['verifyOtp']>>(async () => SESSION),
  };
}
function mockStore(): jest.Mocked<SessionStore> {
  return {
    read: jest.fn<ReturnType<SessionStore['read']>, Parameters<SessionStore['read']>>(async () => null),
    write: jest.fn<ReturnType<SessionStore['write']>, Parameters<SessionStore['write']>>(async () => undefined),
    clear: jest.fn<ReturnType<SessionStore['clear']>, Parameters<SessionStore['clear']>>(async () => undefined),
  };
}
const authority: SessionAuthority = { validate: async () => ({ subjectId: SESSION.owner.id, roles: ['OWNER'] }), revoke: async () => undefined };
const petApi = { list: async () => [], create: async () => { throw new Error('not used'); } };
afterEach(() => cleanup());

function Flow() {
  const { status } = useSession();
  if (status === 'bootstrapping' || status === 'transitioning') return <Text>bootstrap</Text>;
  return status === 'authenticated' ? <AuthenticatedHomeScreen /> : <PublicHomeScreen />;
}

function RaceProbe() {
  const auth = useAuthJourney();
  return <>
    <Text>{`phase:${auth.phase}`}</Text>
    <Pressable onPress={() => auth.start({ kind: 'START_BOOKING' })}><Text>race-start</Text></Pressable>
    <Pressable onPress={() => auth.setPhone('+79991234567')}><Text>race-phone</Text></Pressable>
    <Pressable onPress={() => { void auth.requestOtp(); void auth.requestOtp(); }}><Text>double-request</Text></Pressable>
    <Pressable onPress={() => auth.setCode('123456')}><Text>race-code</Text></Pressable>
    <Pressable onPress={() => { void auth.verifyOtp(); void auth.verifyOtp(); }}><Text>double-verify</Text></Pressable>
    <Pressable onPress={auth.cancel}><Text>race-cancel</Text></Pressable>
  </>;
}

async function setup(api = mockApi()) {
  const store = mockStore();
  const view = await render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SessionProvider store={store} authority={authority} now={() => Date.now()}>
        <AuthJourneyProvider api={api}><PetJourneyProvider api={petApi}><Flow /></PetJourneyProvider></AuthJourneyProvider>
      </SessionProvider>
    </QueryClientProvider>,
  );
  await waitFor(() => expect(view.getByText('Начать запись')).toBeTruthy());
  return { api, store, view };
}

async function setupRace(api = mockApi()) {
  const store = mockStore();
  const view = await render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SessionProvider store={store} authority={authority} now={() => Date.now()}>
        <AuthJourneyProvider api={api}><RaceProbe /></AuthJourneyProvider>
      </SessionProvider>
    </QueryClientProvider>,
  );
  await waitFor(() => expect(view.getByText('phase:idle')).toBeTruthy());
  return { api, store, view };
}

async function requestCode(view: Awaited<ReturnType<typeof setup>>['view']) {
  await act(async () => { fireEvent.press(view.getByText('Начать запись')); });
  await waitFor(() => expect(view.getByLabelText('Номер телефона')).toBeTruthy());
  await act(async () => { fireEvent.changeText(view.getByLabelText('Номер телефона'), '+79991234567'); });
  await act(async () => { fireEvent.press(view.getByText('Получить код')); });
  await waitFor(() => expect(view.getByText('Введите код')).toBeTruthy());
}

async function enterDirectLogin(view: Awaited<ReturnType<typeof setup>>['view']) {
  await act(async () => { fireEvent.press(view.getByText('Войти')); });
  await waitFor(() => expect(view.getByLabelText('Номер телефона')).toBeTruthy());
}

it('completes guest booking intent through OTP and restores it only after T012 handoff', async () => {
  const { api, store, view } = await setup();
  await requestCode(view);
  await act(async () => { fireEvent.changeText(view.getByLabelText('Код из сообщения'), '123456'); });
  await act(async () => { fireEvent.press(view.getByText('Подтвердить')); });
  await waitFor(() => expect(view.getByText('Вход выполнен. Продолжите запись.')).toBeTruthy());
  expect(api.verifyOtp).toHaveBeenCalledWith(CHALLENGE.challengeId, '123456', expect.any(AbortSignal));
  expect(store.write).toHaveBeenCalledWith({ opaqueCredential: SESSION.sessionToken, cacheScope: SESSION.owner.id, expiresAtEpochMs: Date.parse(SESSION.expiresAt) });
  await act(async () => { fireEvent.press(view.getByText('Продолжить запись')); });
  await waitFor(() => expect(view.queryByText('Вход выполнен. Продолжите запись.')).toBeNull());
});

it('direct login uses the canonical authenticated landing without synthetic resume intent', async () => {
  const { view } = await setup();
  await enterDirectLogin(view);
  await act(async () => { fireEvent.changeText(view.getByLabelText('Номер телефона'), '+79991234567'); });
  await act(async () => { fireEvent.press(view.getByText('Получить код')); });
  await act(async () => { fireEvent.changeText(view.getByLabelText('Код из сообщения'), '123456'); });
  await act(async () => { fireEvent.press(view.getByText('Подтвердить')); });
  await waitFor(() => expect(view.getByLabelText('Личный кабинет')).toBeTruthy());
  expect(view.queryByText('Продолжить запись')).toBeNull();
});

it('validates phone locally as UX aid and does not dispatch', async () => {
  const { api, view } = await setup();
  await enterDirectLogin(view);
  await act(async () => { fireEvent.changeText(view.getByLabelText('Номер телефона'), '8999'); });
  await act(async () => { fireEvent.press(view.getByText('Получить код')); });
  expect(view.getByRole('alert').props.accessibilityLabel).toContain('международном формате');
  expect(api.requestOtp).not.toHaveBeenCalled();
});

it.each([
  ['OTP_RATE_LIMITED', 'Сейчас повторить нельзя'],
  ['OTP_PROVIDER_UNAVAILABLE', 'Не удалось подтвердить отправку'],
  [undefined, 'Не удалось выполнить операцию'],
] as const)('maps request failure %s to safe enumeration-neutral copy', async (safeCode, copy) => {
  const api = mockApi(); api.requestOtp.mockRejectedValue(new ApiError('SERVER', 'raw-hidden', 503, undefined, safeCode));
  const { view } = await setup(api);
  await enterDirectLogin(view); await act(async () => { fireEvent.changeText(view.getByLabelText('Номер телефона'), '+79991234567'); });
  await act(async () => { fireEvent.press(view.getByText('Получить код')); });
  expect(view.getByRole('alert').props.accessibilityLabel).toContain(copy);
  expect(view.queryByText('raw-hidden')).toBeNull();
});

it('fences real duplicate request and verify commands to one API call and one session write', async () => {
  const { api, store, view } = await setupRace();
  await act(async () => { fireEvent.press(view.getByText('race-start')); });
  await waitFor(() => expect(view.getByText('phase:phone')).toBeTruthy());
  await act(async () => { fireEvent.press(view.getByText('race-phone')); });
  await act(async () => { fireEvent.press(view.getByText('double-request')); });
  await waitFor(() => expect(view.getByText('phase:otp')).toBeTruthy());
  expect(api.requestOtp).toHaveBeenCalledTimes(1);

  await act(async () => { fireEvent.press(view.getByText('race-code')); });
  await act(async () => { fireEvent.press(view.getByText('double-verify')); });
  await waitFor(() => expect(store.write).toHaveBeenCalledTimes(1));
  expect(api.verifyOtp).toHaveBeenCalledTimes(1);
});

it('ignores a late request completion after cancel and cannot restore or authenticate', async () => {
  let finish!: (value: OtpChallenge) => void;
  const api = mockApi();
  api.requestOtp.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const { store, view } = await setupRace(api);
  await act(async () => { fireEvent.press(view.getByText('race-start')); });
  await waitFor(() => expect(view.getByText('phase:phone')).toBeTruthy());
  await act(async () => { fireEvent.press(view.getByText('race-phone')); });
  await act(async () => { fireEvent.press(view.getByText('double-request')); });
  await waitFor(() => expect(view.getByText('phase:requesting')).toBeTruthy());
  expect(api.requestOtp).toHaveBeenCalledTimes(1);
  await act(async () => { fireEvent.press(view.getByText('race-cancel')); });
  await waitFor(() => expect(view.getByText('phase:idle')).toBeTruthy());
  await act(async () => { finish(CHALLENGE); });
  expect(view.getByText('phase:idle')).toBeTruthy();
  expect(api.verifyOtp).not.toHaveBeenCalled();
  expect(store.write).not.toHaveBeenCalled();
});

it('ignores a late successful verify after cancel and never hands it to T012', async () => {
  let finishVerify!: (value: OwnerSessionResult) => void;
  const api = mockApi();
  api.verifyOtp.mockImplementation(() => new Promise((resolve) => { finishVerify = resolve; }));
  const { store, view } = await setupRace(api);
  await act(async () => { fireEvent.press(view.getByText('race-start')); });
  await waitFor(() => expect(view.getByText('phase:phone')).toBeTruthy());
  await act(async () => { fireEvent.press(view.getByText('race-phone')); });
  await act(async () => { fireEvent.press(view.getByText('double-request')); });
  await waitFor(() => expect(view.getByText('phase:otp')).toBeTruthy());
  await act(async () => { fireEvent.press(view.getByText('race-code')); });
  await act(async () => { fireEvent.press(view.getByText('double-verify')); });
  await waitFor(() => expect(view.getByText('phase:verifying')).toBeTruthy());
  expect(api.verifyOtp).toHaveBeenCalledTimes(1);

  await act(async () => { fireEvent.press(view.getByText('race-cancel')); });
  await waitFor(() => expect(view.getByText('phase:idle')).toBeTruthy());
  await act(async () => { finishVerify(SESSION); });
  expect(view.getByText('phase:idle')).toBeTruthy();
  expect(store.write).not.toHaveBeenCalled();
});

it('resend replaces the authoritative challenge and verification uses only the replacement', async () => {
  const { api, view } = await setup();
  await requestCode(view);
  await waitFor(() => expect(view.getByText('Отправить снова')).toBeTruthy());
  await act(async () => { fireEvent.press(view.getByText('Отправить снова')); });
  await act(async () => { fireEvent.changeText(view.getByLabelText('Код из сообщения'), '123456'); });
  await act(async () => { fireEvent.press(view.getByText('Подтвердить')); });
  expect(api.verifyOtp).toHaveBeenCalledWith(NEW_CHALLENGE.challengeId, '123456', expect.any(AbortSignal));
});

it('renders stale challenge as an action-oriented conflict without authenticating', async () => {
  const api = mockApi(); api.verifyOtp.mockRejectedValue(new ApiError('CONFLICT', 'hidden', 409, undefined, 'OTP_ALREADY_USED'));
  const { store, view } = await setup(api);
  await requestCode(view); await act(async () => { fireEvent.changeText(view.getByLabelText('Код из сообщения'), '123456'); });
  await act(async () => { fireEvent.press(view.getByText('Подтвердить')); });
  expect(view.getByRole('alert').props.accessibilityLabel).toContain('больше не активен');
  expect(view.getByText('Начать вход заново')).toBeTruthy();
  expect(store.write).not.toHaveBeenCalled();
});

it('denies backend-invalid OTP, keeps retry usable and exposes only bounded attempts metadata', async () => {
  const api = mockApi();
  api.verifyOtp.mockRejectedValue(new ApiError('UNAUTHORIZED', 'raw verifier detail', 401, undefined, 'OTP_INVALID', undefined, 4));
  const { store, view } = await setup(api);
  await requestCode(view);
  await act(async () => { fireEvent.changeText(view.getByLabelText('Код из сообщения'), '000000'); });
  await act(async () => { fireEvent.press(view.getByText('Подтвердить')); });
  expect(view.getByRole('alert').props.accessibilityLabel).toContain('Осталось попыток: 4');
  expect(view.queryByText('raw verifier detail')).toBeNull();
  expect(view.getByText('Подтвердить')).toBeTruthy();
  expect(store.write).not.toHaveBeenCalled();
});

it('denies authoritative expired OTP and requires a safe restart without session creation', async () => {
  const api = mockApi();
  api.verifyOtp.mockRejectedValue(new ApiError('UNEXPECTED_RESPONSE', 'raw expiry detail', 410, undefined, 'OTP_EXPIRED'));
  const { store, view } = await setup(api);
  await requestCode(view);
  await act(async () => { fireEvent.changeText(view.getByLabelText('Код из сообщения'), '123456'); });
  await act(async () => { fireEvent.press(view.getByText('Подтвердить')); });
  expect(view.getByRole('alert').props.accessibilityLabel).toContain('Срок действия кода истёк');
  expect(view.getByText('Начать вход заново')).toBeTruthy();
  expect(view.queryByText('raw expiry detail')).toBeNull();
  expect(store.write).not.toHaveBeenCalled();
});
