import { readAppConfig } from './env';

describe('app config', () => {
  it('reads and normalizes the single public API URL boundary', () => {
    expect(readAppConfig({ EXPO_PUBLIC_API_BASE_URL: 'https://api.example.test/' }))
      .toEqual({ apiBaseUrl: 'https://api.example.test' });
  });

  it.each(['relative/path', 'file:///tmp/api'])('rejects unsafe API URL %s', (value) => {
    expect(() => readAppConfig({ EXPO_PUBLIC_API_BASE_URL: value })).toThrow('HTTP(S)');
  });
});
