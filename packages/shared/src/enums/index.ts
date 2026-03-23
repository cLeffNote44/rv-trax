// ---------------------------------------------------------------------------
// RV Trax — Enum-like const objects with derived union types
// ---------------------------------------------------------------------------

// ── User & Auth ─────────────────────────────────────────────────────────────

export const UserRole = {
  OWNER: 'owner',
  MANAGER: 'manager',
  SALES: 'sales',
  SERVICE: 'service',
  PORTER: 'porter',
  VIEWER: 'viewer',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

// ── Units ───────────────────────────────────────────────────────────────────

export const UnitStatus = {
  NEW_ARRIVAL: 'new_arrival',
  PDI_PENDING: 'pdi_pending',
  PDI_IN_PROGRESS: 'pdi_in_progress',
  LOT_READY: 'lot_ready',
  AVAILABLE: 'available',
  HOLD: 'hold',
  SHOWN: 'shown',
  DEPOSIT: 'deposit',
  SOLD: 'sold',
  PENDING_DELIVERY: 'pending_delivery',
  DELIVERED: 'delivered',
  IN_SERVICE: 'in_service',
  WHOLESALE: 'wholesale',
  ARCHIVED: 'archived',
} as const;
export type UnitStatus = (typeof UnitStatus)[keyof typeof UnitStatus];

export const UnitType = {
  MOTORHOME: 'motorhome',
  FIFTH_WHEEL: 'fifth_wheel',
  TRAVEL_TRAILER: 'travel_trailer',
  TOY_HAULER: 'toy_hauler',
  TRUCK_CAMPER: 'truck_camper',
  POPUP: 'popup',
  VAN: 'van',
} as const;
export type UnitType = (typeof UnitType)[keyof typeof UnitType];

// ── Trackers & Gateways ─────────────────────────────────────────────────────

export const TrackerStatus = {
  UNASSIGNED: 'unassigned',
  ASSIGNED: 'assigned',
  LOW_BATTERY: 'low_battery',
  OFFLINE: 'offline',
  RETIRED: 'retired',
} as const;
export type TrackerStatus = (typeof TrackerStatus)[keyof typeof TrackerStatus];

export const GatewayStatus = {
  ONLINE: 'online',
  OFFLINE: 'offline',
} as const;
export type GatewayStatus = (typeof GatewayStatus)[keyof typeof GatewayStatus];

// ── Geo-Fences ──────────────────────────────────────────────────────────────

export const GeoFenceType = {
  LOT_BOUNDARY: 'lot_boundary',
  ZONE: 'zone',
  RESTRICTED: 'restricted',
  STAGING_AREA: 'staging_area',
  SERVICE_AREA: 'service_area',
} as const;
export type GeoFenceType = (typeof GeoFenceType)[keyof typeof GeoFenceType];

// ── Alerts ──────────────────────────────────────────────────────────────────

export const AlertSeverity = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical',
} as const;
export type AlertSeverity = (typeof AlertSeverity)[keyof typeof AlertSeverity];

export const AlertStatus = {
  NEW_ALERT: 'new_alert',
  ACKNOWLEDGED: 'acknowledged',
  DISMISSED: 'dismissed',
  SNOOZED: 'snoozed',
} as const;
export type AlertStatus = (typeof AlertStatus)[keyof typeof AlertStatus];

export const AlertChannel = {
  IN_APP: 'in_app',
  PUSH: 'push',
  EMAIL: 'email',
  SMS: 'sms',
} as const;
export type AlertChannel = (typeof AlertChannel)[keyof typeof AlertChannel];

// ── Work Orders ─────────────────────────────────────────────────────────────

export const WorkOrderType = {
  PDI: 'pdi',
  WINTERIZE: 'winterize',
  DEWINTERIZE: 'dewinterize',
  WARRANTY: 'warranty',
  RECALL: 'recall',
  CUSTOMER_REPAIR: 'customer_repair',
  DETAIL: 'detail',
  OTHER: 'other',
} as const;
export type WorkOrderType = (typeof WorkOrderType)[keyof typeof WorkOrderType];

export const WorkOrderStatus = {
  PENDING: 'pending',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  BLOCKED: 'blocked',
  COMPLETE: 'complete',
  CANCELLED: 'cancelled',
} as const;
export type WorkOrderStatus = (typeof WorkOrderStatus)[keyof typeof WorkOrderStatus];

export const WorkOrderPriority = {
  URGENT: 'urgent',
  NORMAL: 'normal',
  LOW: 'low',
} as const;
export type WorkOrderPriority = (typeof WorkOrderPriority)[keyof typeof WorkOrderPriority];

// ── Lot Spots ───────────────────────────────────────────────────────────────

export const SpotType = {
  STANDARD: 'standard',
  WIDE: 'wide',
  PULL_THROUGH: 'pull_through',
  DISPLAY: 'display',
} as const;
export type SpotType = (typeof SpotType)[keyof typeof SpotType];

// ── Subscriptions ───────────────────────────────────────────────────────────

export const SubscriptionTier = {
  STARTER: 'starter',
  PROFESSIONAL: 'professional',
  ENTERPRISE: 'enterprise',
} as const;
export type SubscriptionTier = (typeof SubscriptionTier)[keyof typeof SubscriptionTier];

export const SubscriptionStatus = {
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELLED: 'cancelled',
  RESTRICTED: 'restricted',
} as const;
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

// ── Audit ───────────────────────────────────────────────────────────────────

export const AuditAction = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  ASSIGN: 'assign',
  UNASSIGN: 'unassign',
  LOGIN: 'login',
  LOGOUT: 'logout',
  INVITE: 'invite',
  STATUS_CHANGE: 'status_change',
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

// ── Location ────────────────────────────────────────────────────────────────

export const LocationSource = {
  GPS: 'gps',
  RSSI: 'rssi',
  MANUAL: 'manual',
} as const;
export type LocationSource = (typeof LocationSource)[keyof typeof LocationSource];

// ── Backhaul ────────────────────────────────────────────────────────────────

export const BackhaulType = {
  ETHERNET: 'ethernet',
  CELLULAR: 'cellular',
  WIFI: 'wifi',
} as const;
export type BackhaulType = (typeof BackhaulType)[keyof typeof BackhaulType];

// ── Staging ────────────────────────────────────────────────────────────────

export const StagingRuleType = {
  BY_TYPE: 'by_type',
  BY_MAKE: 'by_make',
  BY_PRICE_RANGE: 'by_price_range',
  BY_STATUS: 'by_status',
  BY_YEAR: 'by_year',
  MANUAL: 'manual',
} as const;
export type StagingRuleType = (typeof StagingRuleType)[keyof typeof StagingRuleType];

export const StagingPlanStatus = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  ARCHIVED: 'archived',
} as const;
export type StagingPlanStatus = (typeof StagingPlanStatus)[keyof typeof StagingPlanStatus];

export const MoveStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  SKIPPED: 'skipped',
} as const;
export type MoveStatus = (typeof MoveStatus)[keyof typeof MoveStatus];

// ── Recalls ────────────────────────────────────────────────────────────────

export const RecallStatus = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  CLOSED: 'closed',
} as const;
export type RecallStatus = (typeof RecallStatus)[keyof typeof RecallStatus];

// ── Reports ────────────────────────────────────────────────────────────────

export const ReportType = {
  INVENTORY_SUMMARY: 'inventory_summary',
  AGING_REPORT: 'aging_report',
  MOVEMENT_REPORT: 'movement_report',
  STAGING_COMPLIANCE: 'staging_compliance',
  LOT_UTILIZATION: 'lot_utilization',
} as const;
export type ReportType = (typeof ReportType)[keyof typeof ReportType];

export const ReportFormat = {
  CSV: 'csv',
  PDF: 'pdf',
  JSON: 'json',
} as const;
export type ReportFormat = (typeof ReportFormat)[keyof typeof ReportFormat];

export const ReportSchedule = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
} as const;
export type ReportSchedule = (typeof ReportSchedule)[keyof typeof ReportSchedule];

// ── Billing ────────────────────────────────────────────────────────────────

export const BillingEventType = {
  INVOICE_PAID: 'invoice.paid',
  INVOICE_PAYMENT_FAILED: 'invoice.payment_failed',
  SUBSCRIPTION_UPDATED: 'customer.subscription.updated',
  SUBSCRIPTION_DELETED: 'customer.subscription.deleted',
} as const;
export type BillingEventType = (typeof BillingEventType)[keyof typeof BillingEventType];

// ── Feature Flags ──────────────────────────────────────────────────────────

export const FeatureFlag = {
  STAGING: 'staging',
  ANALYTICS: 'analytics',
  RECALLS: 'recalls',
  GEOFENCING: 'geofencing',
  SMS_ALERTS: 'sms_alerts',
  DMS_INTEGRATION: 'dms_integration',
  PUBLIC_API: 'public_api',
} as const;
export type FeatureFlag = (typeof FeatureFlag)[keyof typeof FeatureFlag];

// ── Public API & Webhooks ──────────────────────────────────────────────────

export const WebhookEventType = {
  UNIT_CREATED: 'unit.created',
  UNIT_STATUS_CHANGED: 'unit.status_changed',
  UNIT_MOVED: 'unit.moved',
  GEOFENCE_BREACH: 'geofence.breach',
  TRACKER_BATTERY_LOW: 'tracker.battery_low',
  ALERT_CREATED: 'alert.created',
  WORK_ORDER_COMPLETED: 'work_order.completed',
} as const;
export type WebhookEventType = (typeof WebhookEventType)[keyof typeof WebhookEventType];

export const WebhookStatus = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  FAILED: 'failed',
} as const;
export type WebhookStatus = (typeof WebhookStatus)[keyof typeof WebhookStatus];

export const DmsProvider = {
  IDS_ASTRA: 'ids_astra',
  LIGHTSPEED: 'lightspeed',
  MOTILITY: 'motility',
  DEALER_CLICK: 'dealer_click',
  CSV_IMPORT: 'csv_import',
} as const;
export type DmsProvider = (typeof DmsProvider)[keyof typeof DmsProvider];

export const DmsSyncStatus = {
  IDLE: 'idle',
  SYNCING: 'syncing',
  SUCCESS: 'success',
  ERROR: 'error',
} as const;
export type DmsSyncStatus = (typeof DmsSyncStatus)[keyof typeof DmsSyncStatus];

// ── Staff Activity ────────────────────────────────────────────────────

export const StaffAction = {
  MOVED_UNIT: 'moved_unit',
  CHANGED_STATUS: 'changed_status',
  STARTED_SERVICE: 'started_service',
  COMPLETED_SERVICE: 'completed_service',
  ASSIGNED_TRACKER: 'assigned_tracker',
  UNASSIGNED_TRACKER: 'unassigned_tracker',
  STARTED_TEST_DRIVE: 'started_test_drive',
  COMPLETED_TEST_DRIVE: 'completed_test_drive',
  STARTED_AUDIT: 'started_audit',
  COMPLETED_AUDIT: 'completed_audit',
  VERIFIED_UNIT: 'verified_unit',
  CHECKED_IN_BAY: 'checked_in_bay',
  CHECKED_OUT_BAY: 'checked_out_bay',
  ADVANCED_STAGE: 'advanced_stage',
  CREATED_WORK_ORDER: 'created_work_order',
  UPLOADED_PHOTO: 'uploaded_photo',
} as const;
export type StaffAction = (typeof StaffAction)[keyof typeof StaffAction];

// ── Floor Plan Audits ─────────────────────────────────────────────────

export const FloorPlanAuditStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
} as const;
export type FloorPlanAuditStatus = (typeof FloorPlanAuditStatus)[keyof typeof FloorPlanAuditStatus];

export const AuditItemStatus = {
  PENDING: 'pending',
  VERIFIED: 'verified',
  MISSING: 'missing',
  MISLOCATED: 'mislocated',
} as const;
export type AuditItemStatus = (typeof AuditItemStatus)[keyof typeof AuditItemStatus];

// ── Service Bays ──────────────────────────────────────────────────────

export const ServiceBayType = {
  GENERAL: 'general',
  DETAIL: 'detail',
  BODY: 'body',
  ELECTRICAL: 'electrical',
  PDI: 'pdi',
} as const;
export type ServiceBayType = (typeof ServiceBayType)[keyof typeof ServiceBayType];

export const ServiceBayStatus = {
  AVAILABLE: 'available',
  OCCUPIED: 'occupied',
  MAINTENANCE: 'maintenance',
} as const;
export type ServiceBayStatus = (typeof ServiceBayStatus)[keyof typeof ServiceBayStatus];

export const ServiceStage = {
  CHECKED_IN: 'checked_in',
  DIAGNOSIS: 'diagnosis',
  IN_REPAIR: 'in_repair',
  QUALITY_CHECK: 'quality_check',
  READY: 'ready',
} as const;
export type ServiceStage = (typeof ServiceStage)[keyof typeof ServiceStage];

// ── Dashboard Widgets ─────────────────────────────────────────────────

export const DashboardWidgetType = {
  INVENTORY_SUMMARY: 'inventory_summary',
  TRACKER_HEALTH: 'tracker_health',
  ALERT_FEED: 'alert_feed',
  AGING_CHART: 'aging_chart',
  LOT_UTILIZATION: 'lot_utilization',
  RECENT_ACTIVITY: 'recent_activity',
  UNIT_STATUS_BREAKDOWN: 'unit_status_breakdown',
  QUICK_ACTIONS: 'quick_actions',
} as const;
export type DashboardWidgetType = (typeof DashboardWidgetType)[keyof typeof DashboardWidgetType];

// ── Unit Transfers ─────────────────────────────────────────────────────────

export const TransferStatus = {
  INITIATED: 'initiated',
  IN_TRANSIT: 'in_transit',
  ARRIVED: 'arrived',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;
export type TransferStatus = (typeof TransferStatus)[keyof typeof TransferStatus];
