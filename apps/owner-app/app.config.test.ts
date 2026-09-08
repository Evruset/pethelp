import type { ConfigContext } from 'expo/config';

import { createAppConfig } from './app.config';

const context = { config: { name: 'owner-app', slug: 'owner-app' } } as ConfigContext;
function configure(environment: string, apiBaseUrl?: string) {
  const env: Record<string, string | undefined> = {
    VETHELP_ENV: environment,
    VETHELP_BUILD_NUMBER: '7',
    GITHUB_SHA: 'test-sha',
  };
  if (apiBaseUrl !== undefined) env.EXPO_PUBLIC_API_BASE_URL = apiBaseUrl;
  return createAppConfig(context, env);
}

it('keeps test and pilot identifiers, schemes, environments and endpoints isolated', () => {
  const test = configure('test', 'https://test.example.test');
  const pilot = configure('pilot', 'https://pilot.example.test');
  expect(test.ios?.bundleIdentifier).toBe('ru.vethelp.owner.test');
  expect(test.android?.package).toBe('ru.vethelp.owner.test');
  expect(test.scheme).toBe('ownerapp-test');
  expect(test.extra).toMatchObject({ environment: 'test', apiBaseUrl: 'https://test.example.test' });
  expect(pilot.ios?.bundleIdentifier).toBe('ru.vethelp.owner');
  expect(pilot.android?.package).toBe('ru.vethelp.owner');
  expect(pilot.scheme).toBe('ownerapp');
  expect(pilot.extra).toMatchObject({ environment: 'pilot', apiBaseUrl: 'https://pilot.example.test' });
});

it.each(['test', 'pilot'])('requires an explicit API endpoint for %s', (environment) => {
  expect(() => configure(environment)).toThrow(`EXPO_PUBLIC_API_BASE_URL is required for ${environment}`);
});

it.each(['test', 'pilot'])('requires HTTPS for %s', (environment) => {
  expect(() => configure(environment, 'http://example.test')).toThrow(`${environment} API URL must use HTTPS`);
});

it('rejects credentials embedded in the public API URL', () => {
  expect(() => configure('test', 'https://owner:secret@example.test'))
    .toThrow('EXPO_PUBLIC_API_BASE_URL must not contain credentials');
});

it('fails closed for unknown environment and invalid build number', () => {
  expect(() => configure('production', 'https://example.test')).toThrow('VETHELP_ENV must be local, test, or pilot');
  expect(() => createAppConfig(context, { VETHELP_ENV: 'local', VETHELP_BUILD_NUMBER: '0' }))
    .toThrow('VETHELP_BUILD_NUMBER must be a positive integer');
});
