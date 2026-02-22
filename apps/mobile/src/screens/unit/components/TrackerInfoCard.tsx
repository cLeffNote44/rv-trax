import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Tracker } from '@rv-trax/shared';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getBatteryColor(pct: number): string {
  if (pct > 50) return colors.success;
  if (pct > 20) return colors.warning;
  return colors.error;
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TrackerInfoCardProps {
  tracker: Tracker | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const TrackerInfoCard: React.FC<TrackerInfoCardProps> = ({ tracker }) => {
  if (!tracker) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Tracker</Text>
        <Text style={styles.noTracker}>No tracker assigned to this unit.</Text>
      </View>
    );
  }

  const batteryPct = tracker.battery_pct ?? 0;
  const batteryColor = getBatteryColor(batteryPct);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Tracker</Text>

      <View style={styles.row}>
        <Text style={styles.label}>Device ID</Text>
        <Text style={styles.value}>{tracker.device_eui}</Text>
      </View>

      {/* Battery */}
      <View style={styles.row}>
        <Text style={styles.label}>Battery</Text>
        <View style={styles.batteryContainer}>
          <View style={styles.batteryBarOuter}>
            <View
              style={[
                styles.batteryBarInner,
                { width: `${batteryPct}%`, backgroundColor: batteryColor },
              ]}
            />
          </View>
          <Text style={[styles.batteryPct, { color: batteryColor }]}>
            {tracker.battery_pct != null ? `${tracker.battery_pct}%` : '--'}
          </Text>
        </View>
      </View>

      {/* Signal */}
      <View style={styles.row}>
        <Text style={styles.label}>Status</Text>
        <Text style={styles.value}>{tracker.status}</Text>
      </View>

      {/* Last seen */}
      <View style={styles.row}>
        <Text style={styles.label}>Last Seen</Text>
        <Text style={styles.value}>{relativeTime(tracker.last_seen_at)}</Text>
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.gray900,
    marginBottom: spacing.sm,
  },
  noTracker: {
    fontSize: 14,
    color: colors.gray400,
    fontStyle: 'italic',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  label: {
    fontSize: 14,
    color: colors.gray500,
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray800,
  },
  batteryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  batteryBarOuter: {
    width: 80,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.gray200,
    overflow: 'hidden',
  },
  batteryBarInner: {
    height: '100%',
    borderRadius: 5,
  },
  batteryPct: {
    fontSize: 14,
    fontWeight: '700',
    minWidth: 36,
    textAlign: 'right',
  },
});
