// ---------------------------------------------------------------------------
// RV Trax Mobile — StatusBadge Component
// ---------------------------------------------------------------------------

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { UnitStatus } from '@rv-trax/shared';
import { getStatusColor } from '../utils/geo';

// ---------------------------------------------------------------------------
// Label map
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<string, string> = {
  new_arrival: 'New Arrival',
  pdi_pending: 'PDI Pending',
  pdi_in_progress: 'PDI In Progress',
  lot_ready: 'Lot Ready',
  available: 'Available',
  hold: 'Hold',
  shown: 'Shown',
  deposit: 'Deposit',
  sold: 'Sold',
  pending_delivery: 'Pending Delivery',
  delivered: 'Delivered',
  in_service: 'In Service',
  wholesale: 'Wholesale',
  archived: 'Archived',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface StatusBadgeProps {
  status: UnitStatus;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const bgColor = getStatusColor(status);
  const label = STATUS_LABELS[status] ?? status;

  return (
    <View style={[styles.badge, { backgroundColor: bgColor }]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
