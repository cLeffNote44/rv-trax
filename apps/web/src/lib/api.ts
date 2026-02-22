import type {
  Alert,
  AlertRule,
  ApiKey,
  AuditLogEntry,
  BillingInfo,
  ComplianceScore,
  Dealership,
  DmsIntegration,
  DmsSyncLog,
  Gateway,
  GeoFence,
  InventoryAnalytics,
  Invoice,
  Lot,
  LotUtilization,
  MoveListItem,
  MovementAnalytics,
  PaginatedResponse,
  Recall,
  ScheduledReport,
  StagingPlan,
  StagingPlanDetail,
  Tracker,
  Unit,
  User,
  WebhookDelivery,
  WebhookEndpoint,
  WorkOrder,
} from '@rv-trax/shared';
import { removeToken } from './auth';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

// ---------------------------------------------------------------------------
// Fetch wrapper
// ---------------------------------------------------------------------------

interface FetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Skip automatic JSON content-type header. */
  raw?: boolean;
}

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // sends HttpOnly cookies automatically
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { body, raw, headers: extraHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    ...(extraHeaders as Record<string, string>),
  };

  if (!raw && body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;

  let res = await fetch(url, {
    ...rest,
    headers,
    credentials: 'include', // sends HttpOnly cookies automatically
    body: body !== undefined && !raw ? JSON.stringify(body) : (body as BodyInit),
  });

  // Handle 401 — attempt token refresh once
  if (res.status === 401 && !isRefreshing) {
    isRefreshing = true;
    refreshPromise = refreshAccessToken();
    const success = await refreshPromise;
    isRefreshing = false;
    refreshPromise = null;

    if (success) {
      // Retry original request — new cookie set by refresh response
      res = await fetch(url, {
        ...rest,
        headers,
        credentials: 'include',
        body: body !== undefined && !raw ? JSON.stringify(body) : (body as BodyInit),
      });
    } else {
      removeToken();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new ApiError('Session expired', 'AUTH_EXPIRED', 401);
    }
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new ApiError(
      (errorBody as { message?: string })?.message ?? res.statusText,
      (errorBody as { code?: string })?.code ?? 'UNKNOWN',
      res.status,
      errorBody as Record<string, unknown> | undefined
    );
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ---------------------------------------------------------------------------
// Auth endpoints
// ---------------------------------------------------------------------------

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export function login(data: LoginRequest): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: data,
  });
}

export function logout(): Promise<void> {
  return apiFetch<void>('/auth/logout', { method: 'POST' });
}

export function getMe(): Promise<User> {
  return apiFetch<User>('/auth/me');
}

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

export interface UnitsQuery {
  cursor?: string;
  limit?: number;
  status?: string;
  lot_id?: string;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

export function getUnits(query?: UnitsQuery): Promise<PaginatedResponse<Unit>> {
  const params = new URLSearchParams();
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.set(key, String(value));
      }
    });
  }
  const qs = params.toString();
  return apiFetch<PaginatedResponse<Unit>>(`/units${qs ? `?${qs}` : ''}`);
}

export function getUnit(id: string): Promise<Unit> {
  return apiFetch<Unit>(`/units/${id}`);
}

export function searchUnits(query: string): Promise<Unit[]> {
  return apiFetch<Unit[]>(`/units/search?q=${encodeURIComponent(query)}`);
}

export function updateUnit(id: string, data: Partial<Unit>): Promise<Unit> {
  return apiFetch<Unit>(`/units/${id}`, { method: 'PATCH', body: data });
}

export function createUnit(data: Partial<Unit>): Promise<Unit> {
  return apiFetch<Unit>('/units', { method: 'POST', body: data });
}

export function deleteUnit(id: string): Promise<void> {
  return apiFetch<void>(`/units/${id}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Trackers
// ---------------------------------------------------------------------------

export function getTrackers(query?: {
  cursor?: string;
  limit?: number;
  status?: string;
  unit_id?: string;
}): Promise<PaginatedResponse<Tracker>> {
  const params = new URLSearchParams();
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) params.set(key, String(value));
    });
  }
  const qs = params.toString();
  return apiFetch<PaginatedResponse<Tracker>>(`/trackers${qs ? `?${qs}` : ''}`);
}

export function getTracker(id: string): Promise<Tracker> {
  return apiFetch<Tracker>(`/trackers/${id}`);
}

export function createTracker(data: { device_eui: string; label?: string }): Promise<Tracker> {
  return apiFetch<Tracker>('/trackers', { method: 'POST', body: data });
}

export function updateTracker(id: string, data: Partial<Tracker>): Promise<Tracker> {
  return apiFetch<Tracker>(`/trackers/${id}`, { method: 'PATCH', body: data });
}

export function assignTracker(trackerId: string, unitId: string): Promise<void> {
  return apiFetch<void>(`/trackers/${trackerId}/assign`, { method: 'POST', body: { unit_id: unitId } });
}

export function unassignTracker(trackerId: string): Promise<void> {
  return apiFetch<void>(`/trackers/${trackerId}/unassign`, { method: 'POST' });
}

// ---------------------------------------------------------------------------
// Lots
// ---------------------------------------------------------------------------

export function getLots(): Promise<Lot[]> {
  return apiFetch<Lot[]>('/lots');
}

export function getLot(id: string): Promise<Lot> {
  return apiFetch<Lot>(`/lots/${id}`);
}

export function createLot(data: Partial<Lot>): Promise<Lot> {
  return apiFetch<Lot>('/lots', { method: 'POST', body: data });
}

export function updateLot(id: string, data: Partial<Lot>): Promise<Lot> {
  return apiFetch<Lot>(`/lots/${id}`, { method: 'PATCH', body: data });
}

// ---------------------------------------------------------------------------
// Gateways
// ---------------------------------------------------------------------------

export function getGateways(lotId?: string): Promise<Gateway[]> {
  const qs = lotId ? `?lot_id=${lotId}` : '';
  return apiFetch<Gateway[]>(`/gateways${qs}`);
}

export function createGateway(data: Partial<Gateway>): Promise<Gateway> {
  return apiFetch<Gateway>('/gateways', { method: 'POST', body: data });
}

export function updateGateway(id: string, data: Partial<Gateway>): Promise<Gateway> {
  return apiFetch<Gateway>(`/gateways/${id}`, { method: 'PATCH', body: data });
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export function getAlerts(query?: {
  cursor?: string;
  limit?: number;
  status?: string;
  severity?: string;
}): Promise<PaginatedResponse<Alert>> {
  const params = new URLSearchParams();
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) params.set(key, String(value));
    });
  }
  const qs = params.toString();
  return apiFetch<PaginatedResponse<Alert>>(`/alerts${qs ? `?${qs}` : ''}`);
}

export function acknowledgeAlert(id: string): Promise<Alert> {
  return apiFetch<Alert>(`/alerts/${id}/acknowledge`, { method: 'POST' });
}

export function dismissAlert(id: string): Promise<Alert> {
  return apiFetch<Alert>(`/alerts/${id}/dismiss`, { method: 'POST' });
}

export function getUnreadAlertCount(): Promise<{ count: number }> {
  return apiFetch<{ count: number }>('/alerts/unread-count');
}

export function snoozeAlert(id: string, hours: number): Promise<Alert> {
  return apiFetch<Alert>(`/alerts/${id}/snooze`, { method: 'POST', body: { hours } });
}

export function getAlertRules(): Promise<PaginatedResponse<AlertRule>> {
  return apiFetch<PaginatedResponse<AlertRule>>('/alert-rules');
}

export function createAlertRule(data: Partial<AlertRule>): Promise<AlertRule> {
  return apiFetch<AlertRule>('/alert-rules', { method: 'POST', body: data });
}

export function updateAlertRule(id: string, data: Partial<AlertRule>): Promise<AlertRule> {
  return apiFetch<AlertRule>(`/alert-rules/${id}`, { method: 'PATCH', body: data });
}

export function deleteAlertRule(id: string): Promise<void> {
  return apiFetch<void>(`/alert-rules/${id}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Geofences
// ---------------------------------------------------------------------------

export function getGeofences(lotId?: string): Promise<PaginatedResponse<GeoFence>> {
  const qs = lotId ? `?lot_id=${lotId}` : '';
  return apiFetch<PaginatedResponse<GeoFence>>(`/geofences${qs}`);
}

export function createGeofence(data: Partial<GeoFence>): Promise<GeoFence> {
  return apiFetch<GeoFence>('/geofences', { method: 'POST', body: data });
}

export function updateGeofence(id: string, data: Partial<GeoFence>): Promise<GeoFence> {
  return apiFetch<GeoFence>(`/geofences/${id}`, { method: 'PATCH', body: data });
}

export function deleteGeofence(id: string): Promise<void> {
  return apiFetch<void>(`/geofences/${id}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Work Orders
// ---------------------------------------------------------------------------

export function getWorkOrders(query?: { cursor?: string; limit?: number; status?: string; unit_id?: string }): Promise<PaginatedResponse<WorkOrder>> {
  const params = new URLSearchParams();
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) params.set(key, String(value));
    });
  }
  const qs = params.toString();
  return apiFetch<PaginatedResponse<WorkOrder>>(`/work-orders${qs ? `?${qs}` : ''}`);
}

export function getWorkOrder(id: string): Promise<WorkOrder> {
  return apiFetch<WorkOrder>(`/work-orders/${id}`);
}

export function createWorkOrder(data: Partial<WorkOrder>): Promise<WorkOrder> {
  return apiFetch<WorkOrder>('/work-orders', { method: 'POST', body: data });
}

export function updateWorkOrder(id: string, data: Partial<WorkOrder>): Promise<WorkOrder> {
  return apiFetch<WorkOrder>(`/work-orders/${id}`, { method: 'PATCH', body: data });
}

// ---------------------------------------------------------------------------
// Recalls
// ---------------------------------------------------------------------------

export function getRecalls(query?: { cursor?: string; limit?: number; status?: string }): Promise<PaginatedResponse<Recall>> {
  const params = new URLSearchParams();
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) params.set(key, String(value));
    });
  }
  const qs = params.toString();
  return apiFetch<PaginatedResponse<Recall>>(`/recalls${qs ? `?${qs}` : ''}`);
}

export function createRecall(data: Partial<Recall>): Promise<Recall> {
  return apiFetch<Recall>('/recalls', { method: 'POST', body: data });
}

export function updateRecall(id: string, data: Partial<Recall>): Promise<Recall> {
  return apiFetch<Recall>(`/recalls/${id}`, { method: 'PATCH', body: data });
}

// ---------------------------------------------------------------------------
// Staging
// ---------------------------------------------------------------------------

export function getStagingPlans(query?: { lot_id?: string }): Promise<PaginatedResponse<StagingPlan>> {
  const qs = query?.lot_id ? `?lot_id=${query.lot_id}` : '';
  return apiFetch<PaginatedResponse<StagingPlan>>(`/staging${qs}`);
}

export function getStagingPlan(id: string): Promise<StagingPlanDetail> {
  return apiFetch<StagingPlanDetail>(`/staging/${id}`);
}

export function createStagingPlan(data: Partial<StagingPlan>): Promise<StagingPlan> {
  return apiFetch<StagingPlan>('/staging', { method: 'POST', body: data });
}

export function activateStagingPlan(id: string): Promise<{ move_list: MoveListItem[] }> {
  return apiFetch<{ move_list: MoveListItem[] }>(`/staging/${id}/activate`, { method: 'POST' });
}

export function getComplianceScore(lotId: string): Promise<ComplianceScore> {
  return apiFetch<ComplianceScore>(`/staging/compliance/${lotId}`);
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export function getInventoryAnalytics(): Promise<InventoryAnalytics> {
  return apiFetch<InventoryAnalytics>('/analytics/inventory');
}

export function getLotUtilization(): Promise<LotUtilization[]> {
  return apiFetch<LotUtilization[]>('/analytics/lot-utilization');
}

export function getMovementAnalytics(query?: { days?: number }): Promise<MovementAnalytics> {
  const qs = query?.days ? `?days=${query.days}` : '';
  return apiFetch<MovementAnalytics>(`/analytics/movement${qs}`);
}

export function getTrackerAnalytics(): Promise<{ total: number; assigned: number; low_battery: number; offline: number; avg_battery: number }> {
  return apiFetch('/analytics/trackers');
}

export function getDwellTimeAnalytics(): Promise<{ avg_dwell_days: number; by_type: Record<string, number>; by_make: Record<string, number> }> {
  return apiFetch('/analytics/dwell-time');
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export function getScheduledReports(): Promise<PaginatedResponse<ScheduledReport>> {
  return apiFetch<PaginatedResponse<ScheduledReport>>('/reports');
}

export function createScheduledReport(data: Partial<ScheduledReport>): Promise<ScheduledReport> {
  return apiFetch<ScheduledReport>('/reports', { method: 'POST', body: data });
}

export function updateScheduledReport(id: string, data: Partial<ScheduledReport>): Promise<ScheduledReport> {
  return apiFetch<ScheduledReport>(`/reports/${id}`, { method: 'PATCH', body: data });
}

export function deleteScheduledReport(id: string): Promise<void> {
  return apiFetch<void>(`/reports/${id}`, { method: 'DELETE' });
}

export function generateReport(id: string): Promise<{ url: string }> {
  return apiFetch<{ url: string }>(`/reports/${id}/generate`, { method: 'POST' });
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function getDealershipSettings(): Promise<Dealership> {
  return apiFetch<Dealership>('/settings/dealership');
}

export function updateDealershipSettings(data: Partial<Dealership>): Promise<Dealership> {
  return apiFetch<Dealership>('/settings/dealership', { method: 'PATCH', body: data });
}

export function getUsers(): Promise<User[]> {
  return apiFetch<User[]>('/settings/users');
}

export function inviteUser(data: { email: string; name: string; role: string }): Promise<User> {
  return apiFetch<User>('/settings/users', { method: 'POST', body: data });
}

export function updateUser(id: string, data: Partial<User>): Promise<User> {
  return apiFetch<User>(`/settings/users/${id}`, { method: 'PATCH', body: data });
}

export function deleteUser(id: string): Promise<void> {
  return apiFetch<void>(`/settings/users/${id}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------

export function getBillingOverview(): Promise<BillingInfo> {
  return apiFetch<BillingInfo>('/billing/overview');
}

export function getInvoices(): Promise<Invoice[]> {
  return apiFetch<Invoice[]>('/billing/invoices');
}

// ---------------------------------------------------------------------------
// API Keys
// ---------------------------------------------------------------------------

export function getApiKeys(): Promise<ApiKey[]> {
  return apiFetch<ApiKey[]>('/api-keys');
}

export function createApiKey(data: { name: string; scopes: string[] }): Promise<ApiKey & { key: string }> {
  return apiFetch<ApiKey & { key: string }>('/api-keys', { method: 'POST', body: data });
}

export function revokeApiKey(id: string): Promise<void> {
  return apiFetch<void>(`/api-keys/${id}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

export function getWebhooks(): Promise<WebhookEndpoint[]> {
  return apiFetch<WebhookEndpoint[]>('/webhooks');
}

export function createWebhook(data: { url: string; events: string[] }): Promise<WebhookEndpoint> {
  return apiFetch<WebhookEndpoint>('/webhooks', { method: 'POST', body: data });
}

export function updateWebhook(id: string, data: Partial<WebhookEndpoint>): Promise<WebhookEndpoint> {
  return apiFetch<WebhookEndpoint>(`/webhooks/${id}`, { method: 'PATCH', body: data });
}

export function deleteWebhook(id: string): Promise<void> {
  return apiFetch<void>(`/webhooks/${id}`, { method: 'DELETE' });
}

export function getWebhookDeliveries(webhookId: string): Promise<WebhookDelivery[]> {
  return apiFetch<WebhookDelivery[]>(`/webhooks/${webhookId}/deliveries`);
}

export function testWebhook(id: string): Promise<WebhookDelivery> {
  return apiFetch<WebhookDelivery>(`/webhooks/${id}/test`, { method: 'POST' });
}

// ---------------------------------------------------------------------------
// DMS
// ---------------------------------------------------------------------------

export function getDmsIntegration(): Promise<DmsIntegration | null> {
  return apiFetch<DmsIntegration | null>('/dms');
}

export function configureDms(data: { provider: string; config: Record<string, unknown> }): Promise<DmsIntegration> {
  return apiFetch<DmsIntegration>('/dms', { method: 'POST', body: data });
}

export function triggerDmsSync(): Promise<DmsSyncLog> {
  return apiFetch<DmsSyncLog>('/dms/sync', { method: 'POST' });
}

export function getDmsSyncHistory(): Promise<DmsSyncLog[]> {
  return apiFetch<DmsSyncLog[]>('/dms/sync-history');
}

export function disconnectDms(): Promise<void> {
  return apiFetch<void>('/dms', { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Notification Preferences
// ---------------------------------------------------------------------------

export function getNotificationPreferences(): Promise<{ alert_type: string; in_app: boolean; push: boolean; email: boolean; sms: boolean }[]> {
  return apiFetch('/settings/notification-preferences');
}

export function updateNotificationPreferences(preferences: { alert_type: string; in_app: boolean; push: boolean; email: boolean; sms: boolean }[]): Promise<void> {
  return apiFetch('/settings/notification-preferences', { method: 'PUT', body: preferences });
}

// ---------------------------------------------------------------------------
// User Management (additional)
// ---------------------------------------------------------------------------

export function deactivateUser(id: string): Promise<void> {
  return apiFetch<void>(`/settings/users/${id}/deactivate`, { method: 'POST' });
}

export function resendInvitation(userId: string): Promise<void> {
  return apiFetch<void>(`/settings/users/${userId}/resend-invitation`, { method: 'POST' });
}

export function getDealership(): Promise<Dealership> {
  return apiFetch<Dealership>('/settings/dealership');
}

export function updateDealership(data: Partial<Dealership>): Promise<Dealership> {
  return apiFetch<Dealership>('/settings/dealership', { method: 'PATCH', body: data });
}

// ---------------------------------------------------------------------------
// Audit Log
// ---------------------------------------------------------------------------

export function getAuditLog(query?: {
  cursor?: string;
  limit?: number;
  action?: string;
  entity_type?: string;
  entity_id?: string;
  user_id?: string;
}): Promise<PaginatedResponse<AuditLogEntry>> {
  const params = new URLSearchParams();
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) params.set(key, String(value));
    });
  }
  const qs = params.toString();
  return apiFetch<PaginatedResponse<AuditLogEntry>>(
    `/audit-log${qs ? `?${qs}` : ''}`
  );
}

// ---------------------------------------------------------------------------
// Export the raw fetch for custom endpoints
// ---------------------------------------------------------------------------

export { apiFetch };
