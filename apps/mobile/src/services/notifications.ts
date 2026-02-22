// ---------------------------------------------------------------------------
// RV Trax Mobile — Push Notifications (Firebase Cloud Messaging)
// ---------------------------------------------------------------------------

import { Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import type { apiClient as ApiClientType } from './api';

// ---------------------------------------------------------------------------
// Permission
// ---------------------------------------------------------------------------

/**
 * Request push notification permission from the OS.
 * On iOS this shows the system permission dialog.
 * On Android 13+ (API 33), permission is requested automatically by FCM.
 * Returns true if permission was granted.
 */
export async function requestPermission(): Promise<boolean> {
  const status = await messaging().requestPermission();
  // 1 = AUTHORIZED, 2 = PROVISIONAL
  return status === 1 || status === 2;
}

// ---------------------------------------------------------------------------
// Device token
// ---------------------------------------------------------------------------

/**
 * Retrieve the device push token (APNs on iOS, FCM on Android).
 * Returns an empty string if the token cannot be obtained.
 */
export async function getDeviceToken(): Promise<string> {
  try {
    const token = await messaging().getToken();
    return token;
  } catch (err) {
    console.warn('[Notifications] Failed to get device token:', err);
    return '';
  }
}

/**
 * Send the device token to the backend so the server can push notifications.
 */
export async function registerToken(
  client: typeof ApiClientType,
  token: string,
): Promise<void> {
  const platform = Platform.OS; // 'ios' | 'android'
  await client.registerDeviceToken(token, platform);
}

/**
 * Register for token refresh events. When the FCM token rotates,
 * re-register with the backend.
 * Returns an unsubscribe function.
 */
export function onTokenRefresh(
  client: typeof ApiClientType,
): () => void {
  return messaging().onTokenRefresh(async (newToken) => {
    try {
      const platform = Platform.OS;
      await client.registerDeviceToken(newToken, platform);
    } catch (err) {
      console.warn('[Notifications] Failed to re-register refreshed token:', err);
    }
  });
}

// ---------------------------------------------------------------------------
// Notification handling
// ---------------------------------------------------------------------------

export interface PushNotification {
  title?: string;
  body?: string;
  data?: {
    type?: string;
    unit_id?: string;
    alert_id?: string;
    deep_link?: string;
    [key: string]: unknown;
  };
}

/** Navigation callback — set from the app root once navigation is ready. */
let navigationHandler: ((notification: PushNotification) => void) | null = null;

/**
 * Register a navigation handler to deep-link from notification data.
 * Call this from the root component once navigation ref is available.
 */
export function setNavigationHandler(
  handler: (notification: PushNotification) => void,
): void {
  navigationHandler = handler;
}

/**
 * Parse an incoming push notification and navigate to the relevant screen.
 */
export function handleNotification(notification: PushNotification): void {
  if (navigationHandler) {
    navigationHandler(notification);
  } else {
    console.warn('[Notifications] No navigation handler registered — cannot deep-link');
  }
}

// ---------------------------------------------------------------------------
// Foreground & background listeners
// ---------------------------------------------------------------------------

/**
 * Subscribe to foreground push messages.
 * Returns an unsubscribe function.
 */
export function onForegroundMessage(
  callback: (notification: PushNotification) => void,
): () => void {
  return messaging().onMessage((remoteMessage) => {
    const parsed: PushNotification = {
      title: remoteMessage.notification?.title,
      body: remoteMessage.notification?.body,
      data: remoteMessage.data as PushNotification['data'],
    };
    callback(parsed);
  });
}

/**
 * Subscribe to notification-opened events (user tapped a notification
 * while the app was in background/quit state).
 * Returns an unsubscribe function.
 */
export function onNotificationOpened(): () => void {
  return messaging().onNotificationOpenedApp((remoteMessage) => {
    const parsed: PushNotification = {
      title: remoteMessage.notification?.title,
      body: remoteMessage.notification?.body,
      data: remoteMessage.data as PushNotification['data'],
    };
    handleNotification(parsed);
  });
}

/**
 * Check if the app was launched by tapping a notification (cold start).
 * Call once at app startup.
 */
export async function checkInitialNotification(): Promise<void> {
  const remoteMessage = await messaging().getInitialNotification();
  if (remoteMessage) {
    const parsed: PushNotification = {
      title: remoteMessage.notification?.title,
      body: remoteMessage.notification?.body,
      data: remoteMessage.data as PushNotification['data'],
    };
    handleNotification(parsed);
  }
}

/**
 * Register the background/quit message handler.
 * Must be called at the top level (outside of any component), e.g. in index.js.
 */
export function registerBackgroundHandler(): void {
  messaging().setBackgroundMessageHandler(async (_remoteMessage) => {
    // Background messages are handled by the OS notification tray.
    // Additional processing (badge updates, local DB sync) can go here.
  });
}
