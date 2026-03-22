// ---------------------------------------------------------------------------
// RV Trax — Zod validation schemas for API input
// ---------------------------------------------------------------------------

import { z } from 'zod';
import {
  AlertSeverity,
  DmsProvider,
  GeoFenceType,
  ReportFormat,
  ReportSchedule,
  ReportType,
  StagingRuleType,
  UnitStatus,
  UnitType,
  UserRole,
  WebhookEventType,
  WorkOrderPriority,
  WorkOrderType,
} from '../enums/index.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Validates a VIN (Vehicle Identification Number).
 * Rules: exactly 17 alphanumeric characters, excludes I, O, Q.
 */
export function isValidVin(vin: string): boolean {
  return /^[A-HJ-NPR-Z0-9]{17}$/i.test(vin);
}

const vinSchema = z
  .string()
  .length(17, 'VIN must be exactly 17 characters')
  .refine((v) => isValidVin(v), {
    message: 'Invalid VIN — must be 17 alphanumeric characters (no I, O, or Q)',
  });

/** ISO-8601 date string validator (YYYY-MM-DD). */
const isoDateString = z
  .string()
  .transform((val, ctx) => {
    const parsed = new Date(val);
    if (isNaN(parsed.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid date format — expected ISO-8601 date string',
      });
      return z.NEVER;
    }
    return val;
  });

const latLngPair = z.tuple([
  z.number().min(-90).max(90),
  z.number().min(-180).max(180),
]);

const uuidSchema = z.string().uuid();

// ── Unit values ─────────────────────────────────────────────────────────────

const unitTypeValues = Object.values(UnitType) as [UnitType, ...UnitType[]];
const unitStatusValues = Object.values(UnitStatus) as [UnitStatus, ...UnitStatus[]];

// ── Create / Update Unit ────────────────────────────────────────────────────

export const createUnitSchema = z.object({
  stock_number: z.string().min(1, 'Stock number is required'),
  vin: vinSchema.optional(),
  year: z.number().int().min(1900).max(2100),
  make: z.string().min(1, 'Make is required'),
  model: z.string().min(1, 'Model is required'),
  floorplan: z.string().optional(),
  unit_type: z.enum(unitTypeValues),
  length_ft: z.number().positive().optional(),
  msrp: z.number().nonnegative().optional(),
  status: z.enum(unitStatusValues).default(UnitStatus.NEW_ARRIVAL),
});

export type CreateUnitInput = z.infer<typeof createUnitSchema>;

export const updateUnitSchema = createUnitSchema.partial();

export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;

// ── Tracker ─────────────────────────────────────────────────────────────────

export const createTrackerSchema = z.object({
  device_eui: z.string().min(1, 'Device EUI is required'),
  label: z.string().optional(),
  firmware_version: z.string().optional(),
});

export type CreateTrackerInput = z.infer<typeof createTrackerSchema>;

export const assignTrackerSchema = z.object({
  unit_id: uuidSchema,
});

export type AssignTrackerInput = z.infer<typeof assignTrackerSchema>;

// ── Lot ─────────────────────────────────────────────────────────────────────

export const createLotSchema = z.object({
  name: z.string().min(1, 'Lot name is required'),
  address: z.string().optional(),
  boundary: z.array(latLngPair).min(3, 'Boundary must have at least 3 coordinate pairs'),
});

export type CreateLotInput = z.infer<typeof createLotSchema>;

// ── Geo-Fence ───────────────────────────────────────────────────────────────

const geoFenceTypeValues = Object.values(GeoFenceType) as [GeoFenceType, ...GeoFenceType[]];

export const createGeoFenceSchema = z.object({
  name: z.string().min(1, 'Geo-fence name is required'),
  fence_type: z.enum(geoFenceTypeValues),
  boundary: z.array(latLngPair).min(3, 'Boundary must have at least 3 coordinate pairs'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a hex string (#RRGGBB)').optional(),
});

export type CreateGeoFenceInput = z.infer<typeof createGeoFenceSchema>;

// ── Auth ────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  dealership_name: z.string().min(1, 'Dealership name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;

const userRoleValues = Object.values(UserRole) as [UserRole, ...UserRole[]];

export const inviteUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(userRoleValues),
  name: z.string().min(1, 'Name is required'),
});

export type InviteUserInput = z.infer<typeof inviteUserSchema>;

// ── Work Orders ─────────────────────────────────────────────────────────────

const workOrderTypeValues = Object.values(WorkOrderType) as [WorkOrderType, ...WorkOrderType[]];
const workOrderPriorityValues = Object.values(WorkOrderPriority) as [WorkOrderPriority, ...WorkOrderPriority[]];

export const createWorkOrderSchema = z.object({
  unit_id: uuidSchema,
  order_type: z.enum(workOrderTypeValues),
  priority: z.enum(workOrderPriorityValues).default(WorkOrderPriority.NORMAL),
  assigned_to: uuidSchema.optional(),
  notes: z.string().optional(),
  due_date: isoDateString.optional(),
});

export type CreateWorkOrderInput = z.infer<typeof createWorkOrderSchema>;

// ── Pagination ──────────────────────────────────────────────────────────────

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

// ── Alert Severity (reusable enum schema) ───────────────────────────────────

const alertSeverityValues = Object.values(AlertSeverity) as [AlertSeverity, ...AlertSeverity[]];

export const alertSeveritySchema = z.enum(alertSeverityValues);

// ── Staging Plans ──────────────────────────────────────────────────────────

const stagingRuleTypeValues = Object.values(StagingRuleType) as [StagingRuleType, ...StagingRuleType[]];

const stagingRuleSchema = z.object({
  rule_type: z.enum(stagingRuleTypeValues),
  target_rows: z.array(z.string().min(1)).min(1),
  target_spots: z.array(z.string().uuid()).optional(),
  conditions: z.object({
    unit_types: z.array(z.string()).optional(),
    makes: z.array(z.string()).optional(),
    min_price: z.number().nonnegative().optional(),
    max_price: z.number().nonnegative().optional(),
    statuses: z.array(z.string()).optional(),
    min_year: z.number().int().min(1900).max(2100).optional(),
    max_year: z.number().int().min(1900).max(2100).optional(),
    unit_ids: z.array(z.string().uuid()).optional(),
  }),
  priority: z.number().int().min(0).default(0),
});

export const createStagingPlanSchema = z.object({
  lot_id: uuidSchema,
  name: z.string().min(1, 'Plan name is required'),
  rules: z.array(stagingRuleSchema).default([]),
  is_template: z.boolean().default(false),
});

export type CreateStagingPlanInput = z.infer<typeof createStagingPlanSchema>;

export const updateStagingPlanSchema = z.object({
  name: z.string().min(1).optional(),
  rules: z.array(stagingRuleSchema).optional(),
  is_template: z.boolean().optional(),
});

export type UpdateStagingPlanInput = z.infer<typeof updateStagingPlanSchema>;

// ── Recalls ────────────────────────────────────────────────────────────────

export const createRecallSchema = z.object({
  title: z.string().min(1, 'Recall title is required'),
  description: z.string().optional(),
  affected_vins: z.string().optional(),
  affected_makes: z.array(z.string().min(1)).default([]),
  affected_models: z.array(z.string().min(1)).default([]),
  affected_year_start: z.number().int().min(1900).max(2100).optional(),
  affected_year_end: z.number().int().min(1900).max(2100).optional(),
});

export type CreateRecallInput = z.infer<typeof createRecallSchema>;

// ── Batch Work Orders ──────────────────────────────────────────────────────

export const batchCreateWorkOrdersSchema = z.object({
  unit_ids: z.array(z.string().uuid()).min(1).max(500),
  order_type: z.enum(workOrderTypeValues),
  priority: z.enum(workOrderPriorityValues).default(WorkOrderPriority.NORMAL),
  assigned_to: uuidSchema.optional(),
  notes: z.string().optional(),
  due_date: isoDateString.optional(),
});

export type BatchCreateWorkOrdersInput = z.infer<typeof batchCreateWorkOrdersSchema>;

// ── Analytics & Reports ────────────────────────────────────────────────────

const reportTypeValues = Object.values(ReportType) as [ReportType, ...ReportType[]];
const reportFormatValues = Object.values(ReportFormat) as [ReportFormat, ...ReportFormat[]];
const reportScheduleValues = Object.values(ReportSchedule) as [ReportSchedule, ...ReportSchedule[]];

export const analyticsQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  lot_id: uuidSchema.optional(),
});

export type AnalyticsQueryInput = z.infer<typeof analyticsQuerySchema>;

export const createScheduledReportSchema = z.object({
  report_type: z.enum(reportTypeValues),
  format: z.enum(reportFormatValues).default(ReportFormat.PDF),
  schedule: z.enum(reportScheduleValues),
  recipients: z.array(z.string().email()).min(1, 'At least one recipient is required'),
});

export type CreateScheduledReportInput = z.infer<typeof createScheduledReportSchema>;

// ── Billing ────────────────────────────────────────────────────────────────

export const updateSubscriptionSchema = z.object({
  tier: z.enum(['starter', 'professional', 'enterprise'] as const),
});

export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;

// ── Admin ──────────────────────────────────────────────────────────────────

export const adminDealershipQuerySchema = z.object({
  status: z.string().optional(),
  tier: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

export type AdminDealershipQueryInput = z.infer<typeof adminDealershipQuerySchema>;

export const updateDealershipSettingsSchema = z.object({
  timezone: z.string().optional(),
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  logo_url: z.string().url().optional(),
});

export type UpdateDealershipSettingsInput = z.infer<typeof updateDealershipSettingsSchema>;

export const setFeatureFlagSchema = z.object({
  feature: z.string().min(1),
  enabled: z.boolean(),
});

export type SetFeatureFlagInput = z.infer<typeof setFeatureFlagSchema>;

// ── API Keys ───────────────────────────────────────────────────────────────

export const createApiKeySchema = z.object({
  name: z.string().min(1, 'API key name is required'),
  scopes: z.array(z.string().min(1)).default(['read']),
  expires_in_days: z.number().int().min(1).max(365).optional(),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

// ── Webhooks ───────────────────────────────────────────────────────────────

const webhookEventValues = Object.values(WebhookEventType) as [WebhookEventType, ...WebhookEventType[]];

export const createWebhookSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  events: z.array(z.enum(webhookEventValues)).min(1, 'At least one event is required'),
});

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;

// ── DMS Integration ────────────────────────────────────────────────────────

const dmsProviderValues = Object.values(DmsProvider) as [DmsProvider, ...DmsProvider[]];

export const createDmsIntegrationSchema = z.object({
  provider: z.enum(dmsProviderValues),
  config: z.record(z.string(), z.unknown()).default({}),
});

export type CreateDmsIntegrationInput = z.infer<typeof createDmsIntegrationSchema>;

// ── Unit Transfers ─────────────────────────────────────────────────────────

export const createTransferSchema = z.object({
  unit_id: uuidSchema,
  to_dealership_id: uuidSchema,
  to_lot_id: uuidSchema.optional(),
  notes: z.string().optional(),
});

export type CreateTransferInput = z.infer<typeof createTransferSchema>;

// ── Widget Config ──────────────────────────────────────────────────────────

export const updateWidgetConfigSchema = z.object({
  theme_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  show_statuses: z.array(z.string()).optional(),
  show_prices: z.boolean().optional(),
  link_template: z.string().url().optional(),
  is_active: z.boolean().optional(),
});

export type UpdateWidgetConfigInput = z.infer<typeof updateWidgetConfigSchema>;

// ── Alert Rules ────────────────────────────────────────────────────────────

const alertChannelValues = ['in_app', 'push', 'email', 'sms'] as const;
const userRoleValuesArr = Object.values(UserRole) as [string, ...string[]];
const alertSevValues = Object.values(AlertSeverity) as [string, ...string[]];

export const ALERT_RULE_TYPE_SCHEMAS: Record<string, z.ZodType> = {
  geofence_exit: z.object({ geo_fence_id: z.string().uuid().optional() }),
  geofence_enter: z.object({ geo_fence_id: z.string().uuid().optional() }),
  after_hours_movement: z.object({
    start_hour: z.number().int().min(0).max(23),
    end_hour: z.number().int().min(0).max(23),
    timezone: z.string().min(1),
  }),
  aged_inventory: z.object({ days_threshold: z.number().int().positive().default(90) }),
  tracker_battery_low: z.object({ threshold_pct: z.number().int().min(1).max(100).default(20) }),
  tracker_offline: z.object({ hours_threshold: z.number().positive().default(4) }),
  gateway_offline: z.object({ minutes_threshold: z.number().positive().default(5) }),
};

export const KNOWN_ALERT_RULE_TYPES = Object.keys(ALERT_RULE_TYPE_SCHEMAS);

export const createAlertRuleSchema = z.object({
  rule_type: z.string().min(1),
  parameters: z.record(z.unknown()).default({}),
  severity: z.enum(alertSevValues).default('warning'),
  channels: z.array(z.enum(alertChannelValues)).default(['in_app']),
  recipient_roles: z.array(z.enum(userRoleValuesArr)).optional(),
  recipient_user_ids: z.array(z.string().uuid()).optional(),
});

export type CreateAlertRuleInput = z.infer<typeof createAlertRuleSchema>;

export const updateAlertRuleSchema = z.object({
  parameters: z.record(z.unknown()).optional(),
  severity: z.enum(alertSevValues).optional(),
  channels: z.array(z.enum(alertChannelValues)).optional(),
  recipient_roles: z.array(z.enum(userRoleValuesArr)).optional(),
  recipient_user_ids: z.array(z.string().uuid()).optional(),
  is_active: z.boolean().optional(),
});

export type UpdateAlertRuleInput = z.infer<typeof updateAlertRuleSchema>;

// ── Alert Actions ──────────────────────────────────────────────────────────

export const alertQuerySchema = z.object({
  status: z.string().optional(),
  severity: z.string().optional(),
  alert_type: z.string().optional(),
  unit_id: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

export type AlertQueryInput = z.infer<typeof alertQuerySchema>;

export const snoozeAlertSchema = z.object({
  duration: z.enum(['1h', '4h', '24h']),
});

export type SnoozeAlertInput = z.infer<typeof snoozeAlertSchema>;

export const bulkAcknowledgeSchema = z.object({
  alert_ids: z.array(z.string().uuid()).min(1).max(100),
});

export type BulkAcknowledgeInput = z.infer<typeof bulkAcknowledgeSchema>;

// ── Gateway ────────────────────────────────────────────────────────────────

export const createGatewaySchema = z.object({
  gateway_eui: z.string().min(1, 'Gateway EUI is required'),
  name: z.string().optional(),
  lot_id: z.string().uuid().optional(),
  backhaul_type: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export type CreateGatewayInput = z.infer<typeof createGatewaySchema>;

export const updateGatewaySchema = z.object({
  name: z.string().optional(),
  lot_id: z.string().uuid().optional(),
  backhaul_type: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export type UpdateGatewayInput = z.infer<typeof updateGatewaySchema>;

// ── Device Token ───────────────────────────────────────────────────────────

export const registerDeviceTokenSchema = z.object({
  token: z.string().min(1).max(4096),
  platform: z.enum(['ios', 'android', 'web']),
});

export type RegisterDeviceTokenInput = z.infer<typeof registerDeviceTokenSchema>;

// ── White-Label Branding ───────────────────────────────────────────────────

export const updateBrandingSchema = z.object({
  logo_url: z.string().url().optional(),
  primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a hex string (#RRGGBB)').optional(),
  app_name: z.string().min(1).max(100).optional(),
});

export type UpdateBrandingInput = z.infer<typeof updateBrandingSchema>;

export const setCustomDomainSchema = z.object({
  domain: z.string().min(1, 'Domain is required'),
});

export type SetCustomDomainInput = z.infer<typeof setCustomDomainSchema>;

// ── Location Queries ───────────────────────────────────────────────────────

export const locationHistoryQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  interval: z.enum(['raw', 'hourly', 'daily']).default('raw'),
});

export type LocationHistoryQueryInput = z.infer<typeof locationHistoryQuerySchema>;

export const movementHistoryQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
});

export type MovementHistoryQueryInput = z.infer<typeof movementHistoryQuerySchema>;
