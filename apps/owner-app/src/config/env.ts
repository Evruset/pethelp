const DEFAULT_API_URL = 'http://localhost:3000';

export type AppConfig = Readonly<{ apiBaseUrl: string }>;

export function readAppConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const candidate = env.EXPO_PUBLIC_API_BASE_URL?.trim() || DEFAULT_API_URL;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error('EXPO_PUBLIC_API_BASE_URL must be an absolute HTTP(S) URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('EXPO_PUBLIC_API_BASE_URL must use HTTP(S)');
  }
  return { apiBaseUrl: url.toString().replace(/\/$/, '') };
}

export const appConfig = readAppConfig();
