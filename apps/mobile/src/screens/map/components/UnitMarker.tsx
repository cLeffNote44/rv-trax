import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import type { Unit } from '@rv-trax/shared';
import { colors } from '@/theme/colors';

// ---------------------------------------------------------------------------
// Status color mapping
// ---------------------------------------------------------------------------

export function getStatusColor(status: string): string {
  switch (status) {
    case 'available':
    case 'lot_ready':
      return colors.statusAvailable;

    case 'new_arrival':
    case 'pdi_pending':
    case 'pdi_in_progress':
      return colors.statusNewArrival;

    case 'hold':
    case 'shown':
    case 'deposit':
      return colors.statusHold;

    case 'sold':
    case 'pending_delivery':
    case 'delivered':
      return colors.statusSold;

    case 'in_service':
      return colors.statusInService;

    default:
      return colors.statusArchived;
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface UnitMarkerProps {
  unit: Unit;
  zoomLevel: number;
  onPress: (unit: Unit) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const UnitMarkerComponent: React.FC<UnitMarkerProps> = ({
  unit,
  zoomLevel,
  onPress,
}) => {
  if (unit.current_lat == null || unit.current_lng == null) return null;

  const pinColor = getStatusColor(unit.status);
  const showLabel = zoomLevel > 16;

  return (
    <Marker
      coordinate={{ latitude: unit.current_lat, longitude: unit.current_lng }}
      onPress={() => onPress(unit)}
      tracksViewChanges={false}
    >
      <View style={styles.markerWrapper}>
        <View style={[styles.dot, { backgroundColor: pinColor }]} />
        {showLabel && (
          <View style={styles.labelContainer}>
            <Text style={styles.labelText} numberOfLines={1}>
              {unit.stock_number}
            </Text>
          </View>
        )}
      </View>
    </Marker>
  );
};

export const UnitMarker = memo(UnitMarkerComponent);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  markerWrapper: {
    alignItems: 'center',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.white,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 3,
  },
  labelContainer: {
    backgroundColor: colors.white,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginTop: 2,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 1,
    elevation: 2,
  },
  labelText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.gray800,
  },
});
