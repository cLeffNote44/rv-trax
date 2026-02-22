import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
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

interface SearchResultItemProps {
  unit: Unit;
  onPress: (unit: Unit) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SearchResultItemComponent: React.FC<SearchResultItemProps> = ({
  unit,
  onPress,
}) => {
  const statusColor = getStatusColor(unit.status);
  const locationText = [unit.current_zone, unit.current_row]
    .filter(Boolean)
    .join(' / ');

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        pressed && styles.containerPressed,
      ]}
      onPress={() => onPress(unit)}
    >
      <View style={styles.leftSection}>
        <Text style={styles.stockNumber}>#{unit.stock_number}</Text>
        <Text style={styles.yearMakeModel} numberOfLines={1}>
          {unit.year} {unit.make} {unit.model}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{formatStatus(unit.status)}</Text>
        </View>
      </View>

      <View style={styles.rightSection}>
        {locationText ? (
          <Text style={styles.locationText}>{locationText}</Text>
        ) : (
          <Text style={styles.locationUnknown}>No location</Text>
        )}
      </View>
    </Pressable>
  );
};

export const SearchResultItem = memo(SearchResultItemComponent);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  containerPressed: {
    backgroundColor: colors.gray50,
  },
  leftSection: {
    flex: 1,
    marginRight: spacing.md,
  },
  stockNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray500,
    marginBottom: 2,
  },
  yearMakeModel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: 6,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
  },
  rightSection: {
    alignItems: 'flex-end',
  },
  locationText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.gray600,
  },
  locationUnknown: {
    fontSize: 13,
    color: colors.gray400,
    fontStyle: 'italic',
  },
});
