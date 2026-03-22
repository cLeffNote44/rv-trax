// ---------------------------------------------------------------------------
// RV Trax Mobile — API Client (Ky)
// ---------------------------------------------------------------------------

import ky, { type KyInstance, type NormalizedOptions } from 'ky';
import { API_URL } from '@env';
import type {
  Alert,
  AlertRule,
  Gateway,
  GeoFence,
  LocationRecord,
  Lot,
  LotSpot,
  PaginatedResponse,
  StagingPlan,
  Tracker,
  TrackerAssignment,
  Unit,
  UnitNote,
  User,
  WorkOrder,
} from '@rv-trax/shared';

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class AppError extends Error {
  code: string;
  status: number;
  details?: Record<string, unknown>;
  requestId?: string;

  constructor(
    message: string,
    code: string,
    status: number,
    details?: Record<string, unknown>,
    requestId?: string,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.requestId = requestId;
  }
}

// ---------------------------------------------------------------------------
// Auth store accessor (lazy import to avoid circular deps)
// ---------------------------------------------------------------------------

let _getToken: (() => string | null) | null = null;
let _setToken: ((token: string) => void) | null = null;
let _logout: (() => void) | null = null;

/**
 * Must be called once during app init so the API client can read/write auth
 * tokens without a circular dependency on the auth store module.
 */
export function bindAuthAccessors(
  getToken: () => string | null,
  setToken: (token: string) => void,
  logout: () => void,
): void {
  _getToken = getToken;
  _setToken = setToken;
  _logout = logout;
}

// ---------------------------------------------------------------------------
// Refresh lock — prevent parallel refresh calls
// ---------------------------------------------------------------------------

let refreshPromise: Promise<string> | null = null;

async function performTokenRefresh(api: KyInstance): Promise<string> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await api
        .post('api/v1/auth/refresh', { credentials: 'include' })
        .json<{ access_token: string }>();
      _setToken?.(res.access_token);
      return res.access_token;
    } catch {
      _logout?.();
      throw new AppError('Session expired', 'SESSION_EXPIRED', 401);
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ---------------------------------------------------------------------------
// Ky instance
// ---------------------------------------------------------------------------

export const api: KyInstance = ky.create({
  prefixUrl: API_URL,
  timeout: 30_000,
  credentials: 'include',
  hooks: {
    beforeRequest: [
      (request: Request) => {
        const token = _getToken?.();
        if (token) {
          request.headers.set('Authorization', `Bearer ${token}`);
        }
      },
    ],
    afterResponse: [
      async (
        request: Request,
        _options: NormalizedOptions,
        response: Response,
      ) => {
        if (response.status !== 401) return response;

        // Attempt token refresh and retry the original request once.
        try {
          const newToken = await performTokenRefresh(api);
          request.headers.set('Authorization', `Bearer ${newToken}`);
          return ky(request);
        } catch {
          return response;
        }
      },
    ],
  },
});

// ---------------------------------------------------------------------------
// Error parser
// ---------------------------------------------------------------------------

/**
 * Serialize params object to Record<string, string>, handling arrays and numbers.
 */
function serializeParams(params?: Record<string, unknown>): Record<string, string> {
  if (!params) return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      result[key] = value.join(',');
    } else {
      result[key] = String(value);
    }
  }
  return result;
}

async function parseError(error: unknown): Promise<never> {
  if (error instanceof AppError) throw error;

  // Ky wraps HTTP errors — try to extract the API body.
  if (
    error &&
    typeof error === 'object' &&
    'response' in error &&
    (error as { response?: Response }).response instanceof Response
  ) {
    const response = (error as { response: Response }).response;
    try {
      const body = await response.json() as {
        code?: string;
        message?: string;
        details?: Record<string, unknown>;
        request_id?: string;
      };
      throw new AppError(
        body.message ?? response.statusText,
        body.code ?? 'UNKNOWN',
        response.status,
        body.details,
        body.request_id,
      );
    } catch (e) {
      if (e instanceof AppError) throw e;
      throw new AppError(response.statusText, 'UNKNOWN', response.status);
    }
  }

  throw new AppError(
    error instanceof Error ? error.message : 'Network error',
    'NETWORK_ERROR',
    0,
  );
}

// ---------------------------------------------------------------------------
// Typed helper
// ---------------------------------------------------------------------------

async function request<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    return parseError(error);
  }
}

// ---------------------------------------------------------------------------
// Public API client
// ---------------------------------------------------------------------------

export interface LoginResponse {
  access_token: string;
  user: User;
}

export interface UnitListParams {
  cursor?: string;
  limit?: number;
  status?: string[];
  unit_type?: string[];
  make?: string[];
  search?: string;
}

export interface TrackerListParams {
  cursor?: string;
  limit?: number;
  status?: string;
}

export const apiClient = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  login: (email: string, password: string) =>
    request(api.post('api/v1/auth/login', { json: { email, password } }).json<LoginResponse>()),

  refresh: () =>
    request(
      api
        .post('api/v1/auth/refresh', { credentials: 'include' })
        .json<{ access_token: string }>(),
    ),

  logout: () =>
    request(api.post('api/v1/auth/logout').json<void>()),

  // ── Units ─────────────────────────────────────────────────────────────────
  getUnits: (params?: UnitListParams) =>
    request(api.get('api/v1/units', { searchParams: serializeParams(params) }).json<PaginatedResponse<Unit>>()),

  getUnit: (id: string) =>
    request(api.get(`api/v1/units/${id}`).json<Unit>()),

  searchUnits: (query: string) =>
    request(api.get('api/v1/units/search', { searchParams: { q: query } }).json<Unit[]>()),

  updateUnitStatus: (id: string, status: string) =>
    request(api.patch(`api/v1/units/${id}/status`, { json: { status } }).json<Unit>()),

  // ── Trackers ──────────────────────────────────────────────────────────────
  getTrackers: (params?: TrackerListParams) =>
    request(api.get('api/v1/trackers', { searchParams: serializeParams(params) }).json<PaginatedResponse<Tracker>>()),

  assignTracker: (trackerId: string, unitId: string) =>
    request(api.post(`api/v1/trackers/${trackerId}/assign`, { json: { unit_id: unitId } }).json<TrackerAssignment>()),

  unassignTracker: (trackerId: string) =>
    request(api.post(`api/v1/trackers/${trackerId}/unassign`).json<void>()),

  // ── Lots ──────────────────────────────────────────────────────────────────
  getLots: () =>
    request(api.get('api/v1/lots').json<{ data: Lot[] }>()),

  getLotGrid: (lotId: string) =>
    request(api.get(`api/v1/lots/${lotId}/grid`).json<LotSpot[]>()),

  // ── Notes ─────────────────────────────────────────────────────────────────
  addUnitNote: (unitId: string, content: string) =>
    request(api.post(`api/v1/units/${unitId}/notes`, { json: { content } }).json<UnitNote>()),

  getUnitNotes: (unitId: string) =>
    request(api.get(`api/v1/units/${unitId}/notes`).json<UnitNote[]>()),

  // ── Location History ──────────────────────────────────────────────────────
  getLocationHistory: (unitId: string, from: string, to: string) =>
    request(
      api
        .get(`api/v1/units/${unitId}/location-history`, {
          searchParams: { from, to },
        })
        .json<LocationRecord[]>(),
    ),

  // ── Alerts ────────────────────────────────────────────────────────────────
  getAlerts: () =>
    request(api.get('api/v1/alerts').json<Alert[]>()),

  acknowledgeAlert: (id: string) =>
    request(api.post(`api/v1/alerts/${id}/acknowledge`).json<void>()),

  // ── Geofences ──────────────────────────────────────────────────────────────
  getGeofences: (lotId: string) =>
    request(api.get(`api/v1/lots/${lotId}/geofences`).json<{ data: GeoFence[] }>()),

  // ── Alert Rules ───────────────────────────────────────────────────────────
  getAlertRules: () =>
    request(api.get('api/v1/alert-rules').json<{ data: AlertRule[] }>()),

  // ── Alert Actions ─────────────────────────────────────────────────────────
  dismissAlert: (id: string) =>
    request(api.post(`api/v1/alerts/${id}/dismiss`).json<void>()),

  snoozeAlert: (id: string, duration: '1h' | '4h' | '24h') =>
    request(api.post(`api/v1/alerts/${id}/snooze`, { json: { duration } }).json<void>()),

  // ── Work Orders ───────────────────────────────────────────────────────────
  getWorkOrders: () =>
    request(api.get('api/v1/work-orders').json<{ data: WorkOrder[] }>()),

  getWorkOrder: (id: string) =>
    request(api.get(`api/v1/work-orders/${id}`).json<{ data: WorkOrder }>()),

  createWorkOrder: (data: { unit_id: string; order_type: string; priority?: string; notes?: string }) =>
    request(api.post('api/v1/work-orders', { json: data }).json<{ data: WorkOrder }>()),

  completeWorkOrder: (id: string) =>
    request(api.post(`api/v1/work-orders/${id}/complete`).json<{ data: WorkOrder }>()),

  // ── Staging Plans ─────────────────────────────────────────────────────────
  getStagingPlans: () =>
    request(api.get('api/v1/staging-plans').json<{ data: StagingPlan[] }>()),

  activateStagingPlan: (id: string) =>
    request(api.post(`api/v1/staging-plans/${id}/activate`).json<void>()),

  // ── Gateways ──────────────────────────────────────────────────────────────
  getGateways: () =>
    request(api.get('api/v1/gateways').json<{ data: Gateway[] }>()),

  // ── Settings ──────────────────────────────────────────────────────────────
  getDealershipSettings: () =>
    request(api.get('api/v1/settings').json<{ data: Record<string, unknown> }>()),

  // ── Movement History ──────────────────────────────────────────────────────
  getMovementHistory: (unitId: string, params?: { from?: string; to?: string; limit?: number }) =>
    request(
      api
        .get(`api/v1/units/${unitId}/movement-history`, {
          searchParams: params as Record<string, string>,
        })
        .json<{ data: Record<string, unknown>[] }>(),
    ),

  // ── Live Positions ────────────────────────────────────────────────────────
  getLivePositions: (lotId: string) =>
    request(api.get(`api/v1/lots/${lotId}/live-positions`).json<{ data: Record<string, unknown>[] }>()),

  // ── Device Registration ───────────────────────────────────────────────────
  registerDeviceToken: (token: string, platform: string) =>
    request(
      api
        .post('api/v1/devices/register', { json: { token, platform } })
        .json<void>(),
    ),

  unregisterDeviceToken: () =>
    request(api.delete('api/v1/devices/unregister').json<void>()),
} as const;
