/* eslint-disable @typescript-eslint/no-require-imports -- Jest factories load runtime modules lazily. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { Pressable, Text } from 'react-native';

import { SessionNavigation } from './SessionNavigation';
import { SessionProvider, useSession } from './SessionProvider';
import { ownerQueryKey } from './session-query-cache';
import type { SessionMaterial } from './session';
import type { SessionStore } from './secure-session-store';
import type { SessionAuthority } from './session-authority';
import { ApiError } from '@/api/errors';

jest.mock('expo-router', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const Stack = ({ children }: PropsWithChildren) => React.createElement(React.Fragment, null, children);
  function Protected({ guard, children }: PropsWithChildren<{ guard: boolean }>) {
    return guard ? React.createElement(React.Fragment, null, children) : null;
  }
  function Screen({ name }: { name: string }) {
    return React.createElement(Text, null, `route:${name}`);
  }
  Stack.Protected = Protected;
  Stack.Screen = Screen;
  return { Stack };
});

const VALID_SESSION: SessionMaterial = {
  opaqueCredential: 'opaque-session-material',
  cacheScope: 'owner-scope-a',
  expiresAtEpochMs: 1_000_000,
};

function createStore(initial: SessionMaterial | null | unknown): jest.Mocked<SessionStore> {
  return {
    read: jest.fn(async () => initial as SessionMaterial | null),
    write: jest.fn(async (_session: SessionMaterial) => undefined),
    clear: jest.fn(async () => undefined),
  };
}
function createAuthority():jest.Mocked<SessionAuthority>{return {
  validate:jest.fn<ReturnType<SessionAuthority['validate']>,Parameters<SessionAuthority['validate']>>(async()=>({subjectId:'owner-scope-a',roles:['OWNER']})),
  revoke:jest.fn<ReturnType<SessionAuthority['revoke']>,Parameters<SessionAuthority['revoke']>>(async()=>undefined),
};}

function SessionProbe() {
  const { status, session, error, establishSession, logout } = useSession();
  return (
    <>
      <Text>{`status:${status}`}</Text>
      <Text>{`error:${error??'none'}`}</Text>
      <Text>{`scope:${session?.cacheScope ?? 'none'}`}</Text>
      <Pressable accessibilityRole="button" onPress={() => { void logout(); }}><Text>logout</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => { void establishSession(VALID_SESSION).catch(() => undefined); }}><Text>reauth</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => { void establishSession({ ...VALID_SESSION, opaqueCredential: 'owner-b-session', cacheScope: 'owner-scope-b' }).catch(() => undefined); }}><Text>login-b</Text></Pressable>
    </>
  );
}

async function renderSession(
  store: SessionStore,
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } }),
  authority = createAuthority(),
  now: () => number = () => 1_000,
) {
  return {
    queryClient,
    view: await render(
      <QueryClientProvider client={queryClient}>
        <SessionProvider store={store} now={now} authority={authority}>
          <SessionNavigation />
          <SessionProbe />
        </SessionProvider>
      </QueryClientProvider>,
    ),
  };
}

it('does not render public or protected routes while bootstrap is pending', async () => {
  const store = createStore(null);
  store.read.mockImplementation(() => new Promise(() => undefined));
  const { view } = await renderSession(store);
  expect(view.getByLabelText('Проверяем сессию')).toBeTruthy();
  expect(view.queryByText('route:(public)')).toBeNull();
  expect(view.queryByText('route:(app)')).toBeNull();
});

it('isolates Owner B after Owner A logout without exposing A cache or session scope', async () => {
  const store = createStore(VALID_SESSION);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  queryClient.setQueryData(ownerQueryKey('owner-scope-a', 'profile'), { owner: 'A' });
  queryClient.setQueryData(ownerQueryKey('owner-scope-b', 'profile'), { owner: 'B' });
  const { view } = await renderSession(store, queryClient);
  await waitFor(() => expect(view.getByText('scope:owner-scope-a')).toBeTruthy());

  await act(async () => { fireEvent.press(view.getByText('logout')); });
  await waitFor(() => expect(view.getByText('route:(public)')).toBeTruthy());
  expect(queryClient.getQueryData(ownerQueryKey('owner-scope-a', 'profile'))).toBeUndefined();

  await act(async () => { fireEvent.press(view.getByText('login-b')); });
  await waitFor(() => expect(view.getByText('scope:owner-scope-b')).toBeTruthy());
  expect(queryClient.getQueryData(ownerQueryKey('owner-scope-a', 'profile'))).toBeUndefined();
  expect(queryClient.getQueryData(ownerQueryKey('owner-scope-b', 'profile'))).toEqual({ owner: 'B' });
  expect(store.write).toHaveBeenLastCalledWith(expect.objectContaining({ opaqueCredential: 'owner-b-session', cacheScope: 'owner-scope-b' }));
});

it('opens the public route when no session exists', async () => {
  const { view } = await renderSession(createStore(null));
  await waitFor(() => expect(view.getByText('route:(public)')).toBeTruthy());
  expect(view.queryByText('route:(app)')).toBeNull();
});

it('opens the authenticated route for valid unexpired material', async () => {
  const { view } = await renderSession(createStore(VALID_SESSION));
  await waitFor(() => expect(view.getByText('route:(app)')).toBeTruthy());
  expect(view.queryByText('route:(public)')).toBeNull();
});

it('does not trust stored material until authoritative validation succeeds',async()=>{
  let finish!:(value:{subjectId:string;roles:string[]})=>void; const authority=createAuthority();
  authority.validate.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
  const {view}=await renderSession(createStore(VALID_SESSION),undefined,authority);
  expect(view.getByLabelText('Проверяем сессию')).toBeTruthy(); expect(view.queryByText('route:(app)')).toBeNull();
  await act(async()=>finish({subjectId:'owner-scope-a',roles:['OWNER']}));
  await waitFor(()=>expect(view.getByText('route:(app)')).toBeTruthy());
});

it.each(['expired','revoked','unknown','malformed'])('clears %s backend-invalid session and stays public',async()=>{
  const authority=createAuthority(); authority.validate.mockRejectedValue(new ApiError('UNAUTHORIZED','safe',401)); const store=createStore(VALID_SESSION);
  const {view}=await renderSession(store,undefined,authority); await waitFor(()=>expect(view.getByText('route:(public)')).toBeTruthy());
  expect(store.clear).toHaveBeenCalled(); expect(view.queryByText('route:(app)')).toBeNull();
});

it.each(['SERVER', 'NETWORK', 'TIMEOUT'] as const)('keeps credential for bounded recovery on %s failure and authenticates only after retry succeeds',async(kind)=>{
  const authority=createAuthority(); authority.validate.mockRejectedValueOnce(new ApiError(kind,'safe',kind === 'SERVER' ? 503 : undefined));
  const store=createStore(VALID_SESSION); const {view}=await renderSession(store,undefined,authority);
  await waitFor(()=>expect(view.getByText('Не удалось проверить вход')).toBeTruthy()); expect(store.clear).not.toHaveBeenCalled(); expect(view.queryByText('route:(app)')).toBeNull();
  await act(async()=>fireEvent.press(view.getByText('Повторить'))); await waitFor(()=>expect(view.getByText('route:(app)')).toBeTruthy());
});

it('ignores stale bootstrap validation after a newer session is established',async()=>{
  let finish!:(value:{subjectId:string;roles:string[]})=>void; const authority=createAuthority();
  authority.validate.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
  const store=createStore(VALID_SESSION); const {view}=await renderSession(store,undefined,authority);
  await act(async()=>fireEvent.press(view.getByText('reauth'))); await waitFor(()=>expect(view.getByText('route:(app)')).toBeTruthy());
  await act(async()=>finish({subjectId:'stale-owner',roles:['OWNER']}));
  expect(view.getByText('route:(app)')).toBeTruthy(); expect(store.write).toHaveBeenCalledWith(VALID_SESSION);
});

it('fences stale bootstrap before a newer session write completes', async () => {
  let finishValidation!: (value: { subjectId: string; roles: string[] }) => void;
  let finishWrite!: () => void;
  const authority = createAuthority();
  authority.validate.mockImplementation(() => new Promise((resolve) => { finishValidation = resolve; }));
  const store = createStore(VALID_SESSION);
  store.write.mockImplementation(() => new Promise<void>((resolve) => { finishWrite = resolve; }));
  const { view } = await renderSession(store, undefined, authority);

  await act(async () => { fireEvent.press(view.getByText('reauth')); });
  await act(async () => { finishValidation({ subjectId: 'stale-owner', roles: ['OWNER'] }); });
  expect(view.queryByText('route:(app)')).toBeNull();

  await act(async () => { finishWrite(); });
  await waitFor(() => expect(view.getByText('route:(app)')).toBeTruthy());
});

it('does not persist or publish a stale subject-mismatch bootstrap over a newer login', async () => {
  let finishValidation!: (value: { subjectId: string; roles: string[] }) => void;
  let finishWrite!: () => void;
  const authority = createAuthority();
  authority.validate.mockImplementation(() => new Promise((resolve) => { finishValidation = resolve; }));
  const store = createStore({ ...VALID_SESSION, cacheScope: 'stale-local-scope' });
  store.write.mockImplementation(() => new Promise<void>((resolve) => { finishWrite = resolve; }));
  const { view } = await renderSession(store, undefined, authority);

  await act(async () => { finishValidation({ subjectId: '11111111-1111-4111-8111-111111111111', roles: ['OWNER'] }); });
  await waitFor(() => expect(view.getByText('route:(app)')).toBeTruthy());
  expect(store.write).not.toHaveBeenCalled();

  await act(async () => { fireEvent.press(view.getByText('reauth')); });
  expect(store.write).toHaveBeenCalledTimes(1);
  await act(async () => { finishWrite(); });
  await waitFor(() => expect(view.getByText('route:(app)')).toBeTruthy());
  expect(store.write).toHaveBeenLastCalledWith(VALID_SESSION);
});

it('serializes delayed authoritative-invalid cleanup before a newer login', async () => {
  let finishClear!: () => void;
  const authority = createAuthority();
  authority.validate.mockRejectedValue(new ApiError('UNAUTHORIZED', 'safe', 401));
  const store = createStore(VALID_SESSION);
  store.clear.mockImplementation(() => new Promise<void>((resolve) => { finishClear = resolve; }));
  const { view } = await renderSession(store, undefined, authority);
  await waitFor(() => expect(store.clear).toHaveBeenCalledTimes(1));

  await act(async () => { fireEvent.press(view.getByText('reauth')); });
  expect(store.write).not.toHaveBeenCalled();

  await act(async () => { finishClear(); });
  await waitFor(() => expect(view.getByText('route:(public)')).toBeTruthy());
  await act(async () => { fireEvent.press(view.getByText('reauth')); });
  await waitFor(() => expect(view.getByText('route:(app)')).toBeTruthy());
  expect(store.write).toHaveBeenCalledTimes(1);
});

it('logs out locally and clears owner cache when backend revoke is temporarily unavailable',async()=>{
  const authority=createAuthority(); authority.revoke.mockRejectedValue(new ApiError('NETWORK','safe'));
  const store=createStore(VALID_SESSION); const queryClient=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:Infinity}}});
  queryClient.setQueryData(ownerQueryKey('owner-scope-a','bookings'),['private']);
  const {view}=await renderSession(store,queryClient,authority); await waitFor(()=>expect(view.getByText('route:(app)')).toBeTruthy());
  await act(async()=>fireEvent.press(view.getByText('logout'))); await waitFor(()=>expect(view.getByText('route:(public)')).toBeTruthy());
  expect(authority.revoke).toHaveBeenCalledWith(VALID_SESSION.opaqueCredential); expect(store.clear).toHaveBeenCalled();
  expect(queryClient.getQueryData(ownerQueryKey('owner-scope-a','bookings'))).toBeUndefined();
  expect(view.getByText('error:SESSION_REVOKE_UNCONFIRMED')).toBeTruthy();
});

it('treats an already-revoked backend session as an idempotent local logout', async () => {
  const authority = createAuthority();
  authority.revoke.mockRejectedValue(new ApiError('UNAUTHORIZED', 'safe', 401));
  const store = createStore(VALID_SESSION);
  const { view } = await renderSession(store, undefined, authority);
  await waitFor(() => expect(view.getByText('route:(app)')).toBeTruthy());

  await act(async () => { fireEvent.press(view.getByText('logout')); });
  await waitFor(() => expect(view.getByText('route:(public)')).toBeTruthy());
  expect(store.clear).toHaveBeenCalled();
  expect(view.getByText('error:none')).toBeTruthy();
});

it('clears invalid material and fails closed to the public route', async () => {
  const store = createStore({ opaqueCredential: '', cacheScope: '', expiresAtEpochMs: 'later' });
  const { view } = await renderSession(store);
  await waitFor(() => expect(view.getByText('route:(public)')).toBeTruthy());
  expect(store.clear).toHaveBeenCalledTimes(1);
  expect(view.queryByText('route:(app)')).toBeNull();
});

it('clears expired material and fails closed to the public route', async () => {
  const store = createStore({ ...VALID_SESSION, expiresAtEpochMs: 999 });
  const { view } = await renderSession(store);
  await waitFor(() => expect(view.getByText('route:(public)')).toBeTruthy());
  expect(store.clear).toHaveBeenCalledTimes(1);
  expect(view.queryByText('route:(app)')).toBeNull();
});

it('fails closed and removes expired owner cache even when bootstrap storage cleanup fails', async () => {
  const expired = { ...VALID_SESSION, expiresAtEpochMs: 999 };
  const store = createStore(expired);
  store.clear.mockRejectedValue(new Error('storage unavailable'));
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  queryClient.setQueryData(ownerQueryKey('owner-scope-a', 'bookings'), ['private-a']);
  const { view } = await renderSession(store, queryClient);
  await waitFor(() => expect(view.getByText('route:(public)')).toBeTruthy());
  expect(view.queryByText('route:(app)')).toBeNull();
  expect(queryClient.getQueryData(ownerQueryKey('owner-scope-a', 'bookings'))).toBeUndefined();
});

it('logout clears session and only the active owner cache scope, then re-authenticates through the same boundary', async () => {
  const store = createStore(VALID_SESSION);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  queryClient.setQueryData(ownerQueryKey('owner-scope-a', 'bookings'), ['private-a']);
  queryClient.setQueryData(ownerQueryKey('owner-scope-b', 'bookings'), ['private-b']);
  queryClient.setQueryData(['catalog', 'clinics'], ['public']);
  const { view } = await renderSession(store, queryClient);
  await waitFor(() => expect(view.getByText('route:(app)')).toBeTruthy());

  await act(async () => { fireEvent.press(view.getByText('logout')); });
  await waitFor(() => expect(view.getByText('route:(public)')).toBeTruthy());
  expect(store.clear).toHaveBeenCalledTimes(1);
  expect(queryClient.getQueryData(ownerQueryKey('owner-scope-a', 'bookings'))).toBeUndefined();
  expect(queryClient.getQueryData(ownerQueryKey('owner-scope-b', 'bookings'))).toEqual(['private-b']);
  expect(queryClient.getQueryData(['catalog', 'clinics'])).toEqual(['public']);
  expect(view.queryByText('route:(app)')).toBeNull();

  await act(async () => { fireEvent.press(view.getByText('reauth')); });
  await waitFor(() => expect(view.getByText('route:(app)')).toBeTruthy());
  expect(store.write).toHaveBeenCalledWith(VALID_SESSION);
});

it('fails closed to public when server revoke succeeds but SecureStore deletion fails', async () => {
  const store = createStore(VALID_SESSION);
  store.clear.mockRejectedValue(new Error('storage unavailable'));
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  queryClient.setQueryData(ownerQueryKey('owner-scope-a', 'bookings'), ['private-a']);
  const { view } = await renderSession(store, queryClient);
  await waitFor(() => expect(view.getByText('route:(app)')).toBeTruthy());

  await act(async () => { fireEvent.press(view.getByText('logout')); });
  await waitFor(() => expect(view.getByText('route:(public)')).toBeTruthy());
  expect(view.queryByText('route:(app)')).toBeNull();
  expect(queryClient.getQueryData(ownerQueryKey('owner-scope-a', 'bookings'))).toBeUndefined();
});

it('serializes logout and re-authentication so a pending delete cannot erase a new session', async () => {
  let finishClear: (() => void) | undefined;
  const store = createStore(VALID_SESSION);
  store.clear.mockImplementation(() => new Promise<void>((resolve) => { finishClear = resolve; }));
  const { view } = await renderSession(store);
  await waitFor(() => expect(view.getByText('route:(app)')).toBeTruthy());

  fireEvent.press(view.getByText('logout'));
  await waitFor(() => expect(view.getByText('status:transitioning')).toBeTruthy());
  await act(async () => { fireEvent.press(view.getByText('reauth')); });
  expect(store.write).not.toHaveBeenCalled();

  await act(async () => { finishClear?.(); });
  await waitFor(() => expect(view.getByText('route:(public)')).toBeTruthy());
  await act(async () => { fireEvent.press(view.getByText('reauth')); });
  await waitFor(() => expect(view.getByText('route:(app)')).toBeTruthy());
  expect(store.write).toHaveBeenCalledTimes(1);
});

it('expires an active session, clears its storage and removes only its owner cache scope', async () => {
  jest.useFakeTimers();
  try {
    let nowMs = 1_000;
    const expiring = { ...VALID_SESSION, expiresAtEpochMs: 2_000 };
    const store = createStore(expiring);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    queryClient.setQueryData(ownerQueryKey('owner-scope-a', 'bookings'), ['private-a']);
    queryClient.setQueryData(['catalog', 'clinics'], ['public']);
    const { view } = await renderSession(
      store,
      queryClient,
      createAuthority(),
      () => nowMs,
    );
    await act(async () => { jest.advanceTimersByTime(0); });
    expect(view.getByText('route:(app)')).toBeTruthy();

    await act(async () => {
      nowMs = 2_001;
      await jest.advanceTimersByTimeAsync(1_001);
    });
    expect(view.getByText('route:(public)')).toBeTruthy();
    expect(store.clear).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(ownerQueryKey('owner-scope-a', 'bookings'))).toBeUndefined();
    expect(queryClient.getQueryData(['catalog', 'clinics'])).toEqual(['public']);
  } finally {
    jest.useRealTimers();
  }
});
