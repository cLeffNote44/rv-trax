// ---------------------------------------------------------------------------
// RV Trax — Entity interfaces
// All `id` fields are UUIDs (string). Timestamps are ISO-8601 strings.
// ---------------------------------------------------------------------------

import type {
  AlertChannel,
  AlertSeverity,
  AlertStatus,
  AuditAction,
  BackhaulType,
  DmsProvider,
  DmsSyncStatus,
  GatewayStatus,
  GeoFenceType,
  LocationSource,
  MoveStatus,
  RecallStatus,
  ReportFormat,
  ReportSchedule,
  ReportType,
  SpotType,
  StagingRuleType,
  SubscriptionStatus,
  SubscriptionTier,
  TrackerStatus,
  TransferStatus,
  UnitStatus,
  UnitType,
  UserRole,
  WebhookEventType,
  WebhookStatus,
  WorkOrderPriority,
  WorkOrderStatus,
  WorkOrderType,
} from '../enums/index.js';

// ── Dealerships & Users ─────────────────────────────────────────────────────

export interface DealershipGroup {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Dealership {
  id: string;
  group_id: string | null;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string | null;
  timezone: string;
  subscription_tier: SubscriptionTier;
  subscription_status: SubscriptionStatus;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  dealership_id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar_url: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── Lots & Spots ────────────────────────────────────────────────────────────

export interface Lot {
  id: string;
  dealership_id: string;
  name: string;
  address: string;
  boundary: [number, number][];
  center_lat: number;
  center_lng: number;
  created_at: string;
  updated_at: string;
}

export interface LotSpot {
  id: string;
  lot_id: string;
  label: string;
  zone: string | null;
  row: string | null;
  spot_type: SpotType;
  lat: number;
  lng: number;
  is_occupied: boolean;
  created_at: string;
  updated_at: string;
}

// ── Units ───────────────────────────────────────────────────────────────────

export interface Unit {
  id: string;
  dealership_id: string;
  stock_number: string;
  vin: string | null;
  year: number;
  make: string;
  model: string;
  floorplan: string | null;
  unit_type: UnitType;
  length_ft: number | null;
  msrp: number | null;
  status: UnitStatus;
  lot_id: string | null;
  current_zone: string | null;
  current_row: string | null;
  current_spot: string | null;
  current_lat: number | null;
  current_lng: number | null;
  last_moved_at: string | null;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
}

// ── Trackers & Gateways ─────────────────────────────────────────────────────

export interface Tracker {
  id: string;
  dealership_id: string;
  device_eui: string;
  label: string | null;
  firmware_version: string | null;
  battery_pct: number | null;
  status: TrackerStatus;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrackerAssignment {
  id: string;
  tracker_id: string;
  unit_id: string;
  assigned_by: string;
  assigned_at: string;
  unassigned_at: string | null;
}

export interface Gateway {
  id: string;
  dealership_id: string;
  lot_id: string;
  device_eui: string;
  label: string | null;
  backhaul_type: BackhaulType;
  status: GatewayStatus;
  last_seen_at: string | null;
  ip_address: string | null;
  firmware_version: string | null;
  created_at: string;
  updated_at: string;
}

// ── Location & Movement ─────────────────────────────────────────────────────

export interface LocationRecord {
  id: string;
  tracker_id: string;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  source: LocationSource;
  battery_pct: number | null;
  rssi: number | null;
  gateway_id: string | null;
  recorded_at: string;
}

export interface MovementEvent {
  id: string;
  unit_id: string;
  tracker_id: string;
  from_lat: number;
  from_lng: number;
  to_lat: number;
  to_lng: number;
  distance_m: number;
  from_zone: string | null;
  to_zone: string | null;
  started_at: string;
  ended_at: string;
}

// ── Geo-Fences ──────────────────────────────────────────────────────────────

export interface GeoFence {
  id: string;
  lot_id: string;
  name: string;
  fence_type: GeoFenceType;
  boundary: [number, number][];
  color: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GeoFenceEvent {
  id: string;
  geo_fence_id: string;
  unit_id: string;
  tracker_id: string;
  direction: 'enter' | 'exit';
  lat: number;
  lng: number;
  occurred_at: string;
}

// ── Alerts ──────────────────────────────────────────────────────────────────

export interface AlertRule {
  id: string;
  dealership_id: string;
  name: string;
  description: string | null;
  severity: AlertSeverity;
  channels: AlertChannel[];
  conditions: Record<string, unknown>;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Alert {
  id: string;
  dealership_id: string;
  alert_rule_id: string | null;
  unit_id: string | null;
  tracker_id: string | null;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  message: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  snoozed_until: string | null;
  created_at: string;
  updated_at: string;
}

// ── Staging Plans & Work Orders ─────────────────────────────────────────────

export interface StagingPlan {
  id: string;
  dealership_id: string;
  lot_id: string;
  name: string;
  description: string | null;
  assignments: StagingAssignment[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface StagingAssignment {
  unit_id: string;
  spot_id: string;
  sort_order: number;
}

export interface WorkOrder {
  id: string;
  dealership_id: string;
  unit_id: string;
  order_type: WorkOrderType;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  assigned_to: string | null;
  notes: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ── Audit ───────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  dealership_id: string;
  user_id: string | null;
  action: AuditAction;
  entity_type: string;
  entity_id: string;
  changes: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

// ── Unit Media & Notes ──────────────────────────────────────────────────────

export interface UnitPhoto {
  id: string;
  unit_id: string;
  url: string;
  thumbnail_url: string | null;
  caption: string | null;
  sort_order: number;
  uploaded_by: string;
  created_at: string;
}

export interface UnitNote {
  id: string;
  unit_id: string;
  author_id: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

// ── Staging Rules & Plans ──────────────────────────────────────────────────

export interface StagingRule {
  id: string;
  rule_type: StagingRuleType;
  target_rows: string[];     // row labels to assign to
  target_spots?: string[];   // specific spot IDs (for manual)
  conditions: {
    unit_types?: string[];
    makes?: string[];
    min_price?: number;
    max_price?: number;
    statuses?: string[];
    min_year?: number;
    max_year?: number;
    unit_ids?: string[];     // for manual assignment
  };
  priority: number;          // lower = higher priority (for rule conflicts)
}

export interface StagingPlanDetail {
  id: string;
  dealership_id: string;
  lot_id: string;
  name: string;
  is_active: boolean;
  is_template: boolean;
  rules: StagingRule[];
  activated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MoveListItem {
  id: string;
  unit_id: string;
  stock_number: string;
  make: string;
  model: string;
  year: number;
  current_row: string | null;
  current_spot: number | null;
  current_lat: number | null;
  current_lng: number | null;
  target_row: string;
  target_spot: number;
  target_lat: number;
  target_lng: number;
  distance_m: number;
  priority: number;
  status: MoveStatus;
}

export interface ComplianceScore {
  lot_id: string;
  total_tracked: number;
  in_correct_zone: number;
  score_pct: number;
  out_of_place: Array<{
    unit_id: string;
    stock_number: string;
    expected_row: string;
    actual_row: string | null;
  }>;
  computed_at: string;
}

// ── Recalls ────────────────────────────────────────────────────────────────

export interface Recall {
  id: string;
  dealership_id: string;
  title: string;
  description: string | null;
  affected_vins: string | null;
  affected_makes: string[];
  affected_models: string[];
  affected_year_start: number | null;
  affected_year_end: number | null;
  status: RecallStatus;
  matched_unit_count: number;
  batch_id: string | null;
  created_at: string;
  updated_at: string;
}

// ── Analytics ──────────────────────────────────────────────────────────────

export interface InventoryAnalytics {
  by_type: Record<string, number>;
  by_status: Record<string, number>;
  by_make: Record<string, number>;
  aging_buckets: {
    '0_30': number;
    '31_60': number;
    '61_90': number;
    '91_120': number;
    '120_plus': number;
  };
  total_units: number;
  average_age_days: number;
  stock_turn_rate: number;
}

export interface LotUtilization {
  lot_id: string;
  lot_name: string;
  total_spots: number;
  occupied_spots: number;
  utilization_pct: number;
  by_zone: Array<{
    zone: string;
    total: number;
    occupied: number;
    pct: number;
  }>;
}

export interface MovementAnalytics {
  most_moved_units: Array<{
    unit_id: string;
    stock_number: string;
    move_count: number;
  }>;
  moves_by_day: Array<{
    date: string;
    count: number;
  }>;
  idle_units: Array<{
    unit_id: string;
    stock_number: string;
    days_idle: number;
  }>;
  average_moves_before_sale: number;
}

export interface ScheduledReport {
  id: string;
  dealership_id: string;
  report_type: ReportType;
  format: ReportFormat;
  schedule: ReportSchedule;
  recipients: string[];
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
}

// ── Billing & Subscription ─────────────────────────────────────────────────

export interface BillingInfo {
  dealership_id: string;
  stripe_customer_id: string | null;
  subscription_tier: string;
  subscription_status: string;
  current_period_end: string | null;
  unit_count: number;
  unit_limit: number;
  lot_count: number;
  lot_limit: number;
}

export interface Invoice {
  id: string;
  amount_cents: number;
  currency: string;
  status: string;
  period_start: string;
  period_end: string;
  paid_at: string | null;
  hosted_invoice_url: string | null;
}

// ── Public API & Webhooks ──────────────────────────────────────────────────

export interface ApiKey {
  id: string;
  dealership_id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  rate_limit_per_min: number;
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface WebhookEndpoint {
  id: string;
  dealership_id: string;
  url: string;
  secret: string;
  events: WebhookEventType[];
  status: WebhookStatus;
  failure_count: number;
  last_triggered_at: string | null;
  created_at: string;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: WebhookEventType;
  payload: Record<string, unknown>;
  response_status: number | null;
  response_body: string | null;
  success: boolean;
  attempted_at: string;
}

// ── DMS Integration ────────────────────────────────────────────────────────

export interface DmsIntegration {
  id: string;
  dealership_id: string;
  provider: DmsProvider;
  config: Record<string, unknown>;
  sync_status: DmsSyncStatus;
  last_sync_at: string | null;
  last_error: string | null;
  is_active: boolean;
  created_at: string;
}

export interface DmsSyncLog {
  id: string;
  integration_id: string;
  direction: 'pull' | 'push';
  units_created: number;
  units_updated: number;
  errors: number;
  started_at: string;
  completed_at: string | null;
}

// ── Unit Transfers ─────────────────────────────────────────────────────────

export interface UnitTransfer {
  id: string;
  unit_id: string;
  from_dealership_id: string;
  to_dealership_id: string;
  from_lot_id: string | null;
  to_lot_id: string | null;
  status: TransferStatus;
  initiated_by: string;
  notes: string | null;
  departed_at: string | null;
  arrived_at: string | null;
  completed_at: string | null;
  created_at: string;
}

// ── Widget Config ──────────────────────────────────────────────────────────

export interface WidgetConfig {
  id: string;
  dealership_id: string;
  theme_color: string;
  show_statuses: string[];
  show_prices: boolean;
  link_template: string | null;
  is_active: boolean;
  created_at: string;
}

// ── Generic API types ───────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    next_cursor: string | null;
    has_more: boolean;
    total_count: number;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  request_id: string;
}

export interface JwtPayload {
  sub: string;
  dealershipId: string;
  role: UserRole;
  iat: number;
  exp: number;
}
