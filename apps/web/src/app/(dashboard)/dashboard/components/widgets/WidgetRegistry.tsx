'use client';

import type { LucideIcon } from 'lucide-react';
import { Package, Radio, Bell, Clock, MapPin, Activity, PieChart, Zap } from 'lucide-react';

export interface WidgetDefinition {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  defaultW: number;
  defaultH: number;
}

export const WIDGET_REGISTRY: WidgetDefinition[] = [
  {
    id: 'inventory_summary',
    name: 'Inventory Summary',
    description: 'Total units, available, sold this month, in service',
    icon: Package,
    defaultW: 2,
    defaultH: 1,
  },
  {
    id: 'tracker_health',
    name: 'Tracker Health',
    description: 'Tracker status donut chart',
    icon: Radio,
    defaultW: 1,
    defaultH: 1,
  },
  {
    id: 'alert_feed',
    name: 'Alerts',
    description: 'Unacknowledged alerts summary',
    icon: Bell,
    defaultW: 1,
    defaultH: 1,
  },
  {
    id: 'aging_chart',
    name: 'Aging Overview',
    description: 'Inventory aging distribution',
    icon: Clock,
    defaultW: 2,
    defaultH: 1,
  },
  {
    id: 'lot_utilization',
    name: 'Lot Map',
    description: 'Quick link to interactive lot map',
    icon: MapPin,
    defaultW: 1,
    defaultH: 1,
  },
  {
    id: 'recent_activity',
    name: 'Recent Activity',
    description: 'Latest audit log entries',
    icon: Activity,
    defaultW: 1,
    defaultH: 1,
  },
  {
    id: 'unit_status_breakdown',
    name: 'Status Breakdown',
    description: 'Units by status category',
    icon: PieChart,
    defaultW: 1,
    defaultH: 1,
  },
  {
    id: 'quick_actions',
    name: 'Quick Actions',
    description: 'Shortcuts to common tasks',
    icon: Zap,
    defaultW: 1,
    defaultH: 1,
  },
];

export function getWidgetDef(widgetId: string): WidgetDefinition | undefined {
  return WIDGET_REGISTRY.find((w) => w.id === widgetId);
}
