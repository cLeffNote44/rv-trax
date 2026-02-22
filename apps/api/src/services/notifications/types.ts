// ---------------------------------------------------------------------------
// RV Trax API — Notification service types
// ---------------------------------------------------------------------------

import type {
  Alert,
  Dealership,
  GeoFence,
  Gateway,
  Tracker,
  Unit,
  User,
} from '@rv-trax/shared';

// ── Push Notification ────────────────────────────────────────────────────────

export interface PushParams {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  badge?: number;
}

// ── Email ────────────────────────────────────────────────────────────────────

export interface EmailParams {
  to: string;
  subject: string;
  alert: Alert;
  unit?: Unit;
  tracker?: Tracker;
  gateway?: Gateway;
  dealership: Dealership;
}

// ── SMS ──────────────────────────────────────────────────────────────────────

export interface SmsParams {
  to: string;
  message: string;
}

// ── In-App ───────────────────────────────────────────────────────────────────

export interface InAppPayload {
  alertId: string;
  title: string;
  message: string;
  severity: string;
  unitId: string | null;
  createdAt: string;
}

// ── Notification Result ──────────────────────────────────────────────────────

export interface NotificationResult {
  channel: string;
  success: boolean;
  error?: string;
}

// ── Digest ───────────────────────────────────────────────────────────────────

export interface DigestEntry {
  alert: Alert;
  timestamp: string;
}

// ── Alert Context ────────────────────────────────────────────────────────────

export interface AlertContext {
  unit?: Unit;
  tracker?: Tracker;
  gateway?: Gateway;
  geoFence?: GeoFence;
  dealership: Dealership;
}

// ── Rate Limit ───────────────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: string;
}

export interface RateLimitConfig {
  maxPerHour: number;
}

// ── Recipient Resolution ─────────────────────────────────────────────────────

export interface ResolvedRecipient {
  user: User;
  channels: string[];
}

// ── FCM Message (for push.ts placeholder) ────────────────────────────────────

export interface FcmMessage {
  token: string;
  notification: {
    title: string;
    body: string;
  };
  data: Record<string, string>;
}

// ── Device Token ─────────────────────────────────────────────────────────────

export interface DeviceToken {
  userId: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
  createdAt: string;
}
