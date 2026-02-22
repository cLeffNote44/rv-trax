// ---------------------------------------------------------------------------
// RV Trax API — WebSocket message types
// ---------------------------------------------------------------------------

// ── Inbound messages (client -> server) ------------------------------------

export interface WsAuthMessage {
  type: 'auth';
  token: string;
}

export interface WsPongMessage {
  type: 'pong';
}

export type WsInboundMessage = WsAuthMessage | WsPongMessage;

// ── Outbound messages (server -> client) -----------------------------------

export interface WsConnectedMessage {
  type: 'connected';
  dealership_id: string;
}

export interface WsLocationUpdateMessage {
  type: 'location_update';
  unit_id: string;
  latitude: number;
  longitude: number;
  zone: string | null;
  row: string | null;
  spot: number | null;
  timestamp: string;
}

export interface WsUnitStatusChangeMessage {
  type: 'unit_status_change';
  unit_id: string;
  old_status: string;
  new_status: string;
  changed_by: string;
}

export interface WsAlertMessage {
  type: 'alert';
  alert_id: string;
  alert_type: string;
  severity: string;
  message: string;
  unit_id?: string;
  tracker_id?: string;
}

export interface WsTrackerStatusMessage {
  type: 'tracker_status';
  tracker_id: string;
  status: string;
  battery_pct: number | null;
}

export interface WsGatewayStatusMessage {
  type: 'gateway_status';
  gateway_id: string;
  status: 'online' | 'offline';
}

export interface WsPingMessage {
  type: 'ping';
}

export interface WsErrorMessage {
  type: 'error';
  message: string;
  code?: string;
}

export type WsOutboundMessage =
  | WsConnectedMessage
  | WsLocationUpdateMessage
  | WsUnitStatusChangeMessage
  | WsAlertMessage
  | WsTrackerStatusMessage
  | WsGatewayStatusMessage
  | WsPingMessage
  | WsErrorMessage;

// ── Connection metadata ----------------------------------------------------

export interface ConnectionMeta {
  clientId: string;
  dealershipId: string;
  userId: string;
  connectedAt: Date;
}
