import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import type { Unit } from '@rv-trax/shared';
import { getStatusColor } from '@/screens/map/components/UnitMarker';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatStatus(status: string): string {
  return status
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface UnitHeaderProps {
  unit: Unit;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const UnitHeader: React.FC<UnitHeaderProps> = ({ unit }) => {
  const statusColor = getStatusColor(unit.status);

  return (
    <View style={styles.container}>
      {/* Photo or placeholder */}
      {unit.thumbnail_url ? (
        <Image
          source={{ uri: unit.thumbnail_url }}
          style={styles.photo}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.photo, styles.placeholder]}>
          <Text style={styles.placeholderText}>No Photo</Text>
        </View>
      )}

      {/* Info overlay */}
      <View style={styles.infoOverlay}>
        <Text style={styles.stockNumber}>#{unit.stock_number}</Text>
        <Text style={styles.yearMakeModel}>
          {unit.year} {unit.make} {unit.model}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{formatStatus(unit.status)}</Text>
        </View>
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.gray900,
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: 220,
    backgroundColor: colors.gray200,
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 18,
    color: colors.gray400,
    fontWeight: '600',
  },
  infoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    paddingTop: spacing.xxl,
    backgroundColor: 'rgba(0,0,0,0.0)',
    // Gradient would be applied via LinearGradient in production
  },
  stockNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
    opacity: 0.9,
  },
  yearMakeModel: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.white,
    marginTop: 2,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: spacing.sm,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
  },
});
