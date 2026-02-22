// ---------------------------------------------------------------------------
// RV Trax Mobile — API Client (Ky)
// ---------------------------------------------------------------------------

import ky, { type KyInstance, type NormalizedOptions } from 'ky';
import { API_URL } from '@env';
import type {
  Alert,
  LocationRecord,
  Lot,
  LotSpot,
  PaginatedResponse,
  Tracker,
  TrackerAssignment,
  Unit,
  UnitNote,
  User,
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
    request(api.get('api/v1/units', { searchParams: params as Record<string, string> }).json<PaginatedResponse<Unit>>()),

  getUnit: (id: string) =>
    request(api.get(`api/v1/units/${id}`).json<Unit>()),

  searchUnits: (query: string) =>
    request(api.get('api/v1/units/search', { searchParams: { q: query } }).json<Unit[]>()),

  updateUnitStatus: (id: string, status: string) =>
    request(api.patch(`api/v1/units/${id}/status`, { json: { status } }).json<Unit>()),

  // ── Trackers ──────────────────────────────────────────────────────────────
  getTrackers: (params?: TrackerListParams) =>
    request(api.get('api/v1/trackers', { searchParams: params as Record<string, string> }).json<PaginatedResponse<Tracker>>()),

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

  // ── Device Registration ───────────────────────────────────────────────────
  registerDeviceToken: (token: string, platform: string) =>
    request(
      api
        .post('api/v1/devices/register', { json: { token, platform } })
        .json<void>(),
    ),
} as const;
