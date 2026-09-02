import type { ConfigContext, ExpoConfig } from 'expo/config';

type MobileEnvironment = 'local' | 'test' | 'pilot';

const ENVIRONMENTS: Record<MobileEnvironment, Readonly<{
  nameSuffix: string;
  scheme: string;
  iosBundleIdentifier: string;
  androidPackage: string;
}>> = {
  local: {
    nameSuffix: ' Local',
    scheme: 'ownerapp-local',
    iosBundleIdentifier: 'ru.vethelp.owner.local',
    androidPackage: 'ru.vethelp.owner.local',
  },
  test: {
    nameSuffix: ' Test',
    scheme: 'ownerapp-test',
    iosBundleIdentifier: 'ru.vethelp.owner.test',
    androidPackage: 'ru.vethelp.owner.test',
  },
  pilot: {
    nameSuffix: '',
    scheme: 'ownerapp',
    iosBundleIdentifier: 'ru.vethelp.owner',
    androidPackage: 'ru.vethelp.owner',
  },
};

type ConfigEnvironment = Readonly<Record<string, string | undefined>>;

function readEnvironment(env: ConfigEnvironment): MobileEnvironment {
  const value = env.VETHELP_ENV?.trim() || 'local';
  if (value === 'local' || value === 'test' || value === 'pilot') return value;
  throw new Error('VETHELP_ENV must be local, test, or pilot');
}

function readApiBaseUrl(env: ConfigEnvironment, environment: MobileEnvironment): string {
  const value = env.EXPO_PUBLIC_API_BASE_URL?.trim()
    || (environment === 'local' ? 'http://localhost:3000' : '');
  if (!value) throw new Error(`EXPO_PUBLIC_API_BASE_URL is required for ${environment}`);
  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('EXPO_PUBLIC_API_BASE_URL must use HTTP(S)');
  if (url.username || url.password) throw new Error('EXPO_PUBLIC_API_BASE_URL must not contain credentials');
  if (environment !== 'local' && url.protocol !== 'https:') throw new Error(`${environment} API URL must use HTTPS`);
  return url.toString().replace(/\/$/, '');
}

function readAndroidVersionCode(env: ConfigEnvironment): number {
  const value = Number(env.VETHELP_BUILD_NUMBER ?? '1');
  if (!Number.isSafeInteger(value) || value < 1) throw new Error('VETHELP_BUILD_NUMBER must be a positive integer');
  return value;
}

export function createAppConfig({ config }: ConfigContext, env: ConfigEnvironment): ExpoConfig {
  const environment = readEnvironment(env);
  const environmentConfig = ENVIRONMENTS[environment];
  const apiBaseUrl = readApiBaseUrl(env, environment);
  const gitSha = env.EAS_BUILD_GIT_COMMIT_HASH || env.GITHUB_SHA || 'local';
  const buildNumber = String(readAndroidVersionCode(env));

  return {
    ...config,
    name: `VetHelp${environmentConfig.nameSuffix}`,
    slug: 'owner-app',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: environmentConfig.scheme,
    ios: {
      icon: './assets/expo.icon',
      bundleIdentifier: environmentConfig.iosBundleIdentifier,
      buildNumber,
    },
    android: {
      package: environmentConfig.androidPackage,
      versionCode: readAndroidVersionCode(env),
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
    },
    web: { output: 'server', favicon: './assets/images/favicon.png' },
    plugins: [
      'expo-router',
      ['expo-splash-screen', { backgroundColor: '#208AEF', image: './assets/images/splash-icon.png', imageWidth: 76 }],
      'expo-secure-store',
      ['expo-build-properties', { ios: { deploymentTarget: '16.4' }, android: { minSdkVersion: 29 } }],
    ],
    experiments: { typedRoutes: true, reactCompiler: true },
    extra: {
      environment,
      apiBaseUrl,
      build: {
        gitSha,
        easBuildId: env.EAS_BUILD_ID || null,
      },
    },
  };
}

export default (context: ConfigContext): ExpoConfig => createAppConfig(context, process.env);
