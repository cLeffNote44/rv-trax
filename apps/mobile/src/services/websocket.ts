// ---------------------------------------------------------------------------
// RV Trax Mobile — WebSocket Manager
// ---------------------------------------------------------------------------

import { WS_URL } from '@env';

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

export type LocationUpdate = {
  unit_id: string;
  lat: number;
  lng: number;
  zone: string;
  row: string;
  spot: number;
  timestamp: string;
};

export type UnitStatusChange = {
  unit_id: string;
  old_status: string;
  new_status: string;
  changed_by: string;
};

export type AlertEvent = {
  alert_id: string;
  alert_type: string;
  message: string;
  unit_id?: string;
};

export type TrackerStatusEvent = {
  tracker_id: string;
  status: string;
  battery_pct: number;
};

type WsMessage =
  | { type: 'location_update'; payload: LocationUpdate }
  | { type: 'unit_status_change'; payload: UnitStatusChange }
  | { type: 'alert'; payload: AlertEvent }
  | { type: 'tracker_status'; payload: TrackerStatusEvent }
  | { type: 'connected'; dealership_id: string }
  | { type: 'ping' }
  | { type: 'error'; message: string; code?: string };

type Callback<T> = (data: T) => void;

// ---------------------------------------------------------------------------
// WebSocket Manager
// ---------------------------------------------------------------------------

const MAX_RECONNECT_DELAY_MS = 30_000;
const INITIAL_RECONNECT_DELAY_MS = 1_000;

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;

  // Callback registries
  private locationHandlers: Callback<LocationUpdate>[] = [];
  private statusChangeHandlers: Callback<UnitStatusChange>[] = [];
  private alertHandlers: Callback<AlertEvent>[] = [];
  private trackerStatusHandlers: Callback<TrackerStatusEvent>[] = [];
  private connectionHandlers: Callback<boolean>[] = [];

  // ── Connection ────────────────────────────────────────────────────────────

  connect(token: string): void {
    this.token = token;
    this.intentionalClose = false;
    this.openConnection();
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.cleanup();
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // ── Event Registration ────────────────────────────────────────────────────

  onLocationUpdate(callback: Callback<LocationUpdate>): () => void {
    this.locationHandlers.push(callback);
    return () => {
      this.locationHandlers = this.locationHandlers.filter((h) => h !== callback);
    };
  }

  onUnitStatusChange(callback: Callback<UnitStatusChange>): () => void {
    this.statusChangeHandlers.push(callback);
    return () => {
      this.statusChangeHandlers = this.statusChangeHandlers.filter((h) => h !== callback);
    };
  }

  onAlert(callback: Callback<AlertEvent>): () => void {
    this.alertHandlers.push(callback);
    return () => {
      this.alertHandlers = this.alertHandlers.filter((h) => h !== callback);
    };
  }

  onTrackerStatus(callback: Callback<TrackerStatusEvent>): () => void {
    this.trackerStatusHandlers.push(callback);
    return () => {
      this.trackerStatusHandlers = this.trackerStatusHandlers.filter(
        (h) => h !== callback,
      );
    };
  }

  onConnectionChange(callback: Callback<boolean>): () => void {
    this.connectionHandlers.push(callback);
    return () => {
      this.connectionHandlers = this.connectionHandlers.filter(
        (h) => h !== callback,
      );
    };
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private openConnection(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Connect to bare URL — token is sent as first message, never in the URL
    this.ws = new WebSocket(WS_URL);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      // Send auth token as first message (server expects this within 5s)
      this.ws?.send(JSON.stringify({ type: 'auth', token: this.token }));
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(String(event.data));
    };

    this.ws.onerror = () => {
      // Error details are limited in RN; onclose will fire next.
    };

    this.ws.onclose = () => {
      this.notifyConnection(false);
      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    };
  }

  private handleMessage(raw: string): void {
    let msg: WsMessage;
    try {
      msg = JSON.parse(raw) as WsMessage;
    } catch {
      return;
    }

    switch (msg.type) {
      case 'connected':
        // Auth confirmed by server — connection is now ready
        this.notifyConnection(true);
        break;
      case 'ping':
        // Server-initiated heartbeat — respond with pong
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'pong' }));
        }
        break;
      case 'error':
        // Server sent an error (auth failure, etc.) — connection will close
        break;
      case 'location_update':
        this.locationHandlers.forEach((h) => h(msg.payload as LocationUpdate));
        break;
      case 'unit_status_change':
        this.statusChangeHandlers.forEach((h) =>
          h(msg.payload as UnitStatusChange),
        );
        break;
      case 'alert':
        this.alertHandlers.forEach((h) => h(msg.payload as AlertEvent));
        break;
      case 'tracker_status':
        this.trackerStatusHandlers.forEach((h) =>
          h(msg.payload as TrackerStatusEvent),
        );
        break;
    }
  }

  // ── Reconnect ─────────────────────────────────────────────────────────────

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    const delay = Math.min(
      INITIAL_RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts),
      MAX_RECONNECT_DELAY_MS,
    );
    this.reconnectAttempts += 1;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openConnection();
    }, delay);
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  private cleanup(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }

    this.notifyConnection(false);
  }

  private notifyConnection(connected: boolean): void {
    this.connectionHandlers.forEach((h) => h(connected));
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const wsManager = new WebSocketManager();
