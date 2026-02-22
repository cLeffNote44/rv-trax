import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker } from 'react-native-maps';
import type { Unit } from '@rv-trax/shared';
import { getStatusColor } from '@/screens/map/components/UnitMarker';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LocationCardProps {
  unit: Unit;
  onNavigate: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const LocationCard: React.FC<LocationCardProps> = ({
  unit,
  onNavigate,
}) => {
  const hasLocation = unit.current_lat != null && unit.current_lng != null;
  const locationText = [unit.current_zone, unit.current_row]
    .filter(Boolean)
    .join(' / ');

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Location</Text>

      {hasLocation ? (
        <View style={styles.mapContainer}>
          <MapView
            style={styles.miniMap}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude: unit.current_lat!,
              longitude: unit.current_lng!,
              latitudeDelta: 0.002,
              longitudeDelta: 0.002,
            }}
            scrollEnabled={false}
            zoomEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
            toolbarEnabled={false}
            showsUserLocation={false}
          >
            <Marker
              coordinate={{
                latitude: unit.current_lat!,
                longitude: unit.current_lng!,
              }}
            >
              <View
                style={[
                  styles.pin,
                  { backgroundColor: getStatusColor(unit.status) },
                ]}
              />
            </Marker>
          </MapView>
        </View>
      ) : (
        <View style={styles.noLocation}>
          <Text style={styles.noLocationText}>Location not available</Text>
        </View>
      )}

      <View style={styles.footer}>
        {locationText ? (
          <Text style={styles.locationText}>{locationText}</Text>
        ) : (
          <Text style={styles.locationUnknown}>Zone/Row unknown</Text>
        )}
        <TouchableOpacity
          style={styles.navigateButton}
          onPress={onNavigate}
          activeOpacity={0.7}
          disabled={!hasLocation}
        >
          <Text
            style={[
              styles.navigateText,
              !hasLocation && styles.navigateTextDisabled,
            ]}
          >
            Navigate
          </Text>
        </TouchableOpacity>
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
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    overflow: 'hidden',
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
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  mapContainer: {
    height: 150,
    borderRadius: 0,
    overflow: 'hidden',
  },
  miniMap: {
    ...StyleSheet.absoluteFillObject,
  },
  pin: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.white,
  },
  noLocation: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.gray100,
  },
  noLocationText: {
    fontSize: 14,
    color: colors.gray400,
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  locationText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray700,
  },
  locationUnknown: {
    fontSize: 14,
    color: colors.gray400,
  },
  navigateButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
  },
  navigateText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  navigateTextDisabled: {
    opacity: 0.4,
  },
});
