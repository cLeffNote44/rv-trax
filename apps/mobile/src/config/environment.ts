/**
 * Environment configuration for RV Trax mobile app.
 * Values are resolved at build time via react-native-config or .env files.
 */

interface AppConfig {
  apiUrl: string;
  wsUrl: string;
  sentryDsn: string | undefined;
  environment: 'development' | 'staging' | 'production';
  version: string;
  buildNumber: number;
  enableAnalytics: boolean;
  enableCrashReporting: boolean;
  deepLinkScheme: string;
  universalLinkDomain: string;
}

function resolveConfig(): AppConfig {
  if (__DEV__) {
    return {
      apiUrl: 'http://localhost:3000/api/v1',
      wsUrl: 'ws://localhost:3000/ws',
      sentryDsn: undefined,
      environment: 'development',
      version: '1.0.0',
      buildNumber: 1,
      enableAnalytics: false,
      enableCrashReporting: false,
      deepLinkScheme: 'rvtrax',
      universalLinkDomain: 'app.rvtrax.com',
    };
  }

  return {
    apiUrl: process.env.API_URL ?? 'https://api.rvtrax.com/api/v1',
    wsUrl: process.env.WS_URL ?? 'wss://api.rvtrax.com/ws',
    sentryDsn: process.env.SENTRY_DSN,
    environment: (process.env.APP_ENV as AppConfig['environment']) ?? 'production',
    version: '1.0.0',
    buildNumber: parseInt(process.env.BUILD_NUMBER ?? '1', 10),
    enableAnalytics: true,
    enableCrashReporting: true,
    deepLinkScheme: 'rvtrax',
    universalLinkDomain: 'app.rvtrax.com',
  };
}

export const appConfig = resolveConfig();
