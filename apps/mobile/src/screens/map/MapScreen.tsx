import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import MapView, {
  PROVIDER_GOOGLE,
  Polygon,
  Region,
} from 'react-native-maps';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import type { Unit } from '@rv-trax/shared';
import { useUnitStore } from '@/stores/useUnitStore';
import { useMapStore } from '@/stores/useMapStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { apiClient } from '@/services/api';
import { UnitMarker } from './components/UnitMarker';
import { UnitBottomSheet } from './components/UnitBottomSheet';
import { MapFilters } from './components/MapFilters';
import { colors } from '@/theme/colors';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getZoomLevel(region: Region): number {
  return Math.round(Math.log(360 / region.longitudeDelta) / Math.LN2);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const MapScreen: React.FC = () => {
  const mapRef = useRef<MapView>(null);

  const units = useUnitStore((s) => s.units);
  const selectedUnit = useUnitStore((s) => s.selectedUnit);
  const setSelectedUnit = useUnitStore((s) => s.setSelectedUnit);
  const fetchUnits = useUnitStore((s) => s.fetchUnits);

  const region = useMapStore((s) => s.region);
  const setRegion = useMapStore((s) => s.setRegion);
  const filters = useMapStore((s) => s.filters);
  const lotBoundary = useMapStore((s) => s.lotBoundary);
  const setLotBoundary = useMapStore((s) => s.setLotBoundary);

  const mapTypeSatellite = useSettingsStore((s) => s.mapTypeSatellite);
  const setMapTypeSatellite = useSettingsStore((s) => s.setMapTypeSatellite);
  const mapType = mapTypeSatellite ? 'satellite' as const : 'standard' as const;

  const [filtersVisible, setFiltersVisible] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(15);
  const [lotCenter, setLotCenter] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  // Fetch lot boundary from API
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.getLots();
        if (cancelled || !res.data.length) return;
        const lot = res.data[0];

        // Parse boundary — DB stores as JSON text
        const raw = lot.boundary;
        const coords: [number, number][] =
          typeof raw === 'string' ? JSON.parse(raw) : Array.isArray(raw) ? raw : [];

        if (coords.length >= 3) {
          const mapped = coords.map(([lat, lng]) => ({ latitude: lat, longitude: lng }));
          setLotBoundary(mapped);

          // Compute centroid for initial region
          const centerLat = mapped.reduce((s, c) => s + c.latitude, 0) / mapped.length;
          const centerLng = mapped.reduce((s, c) => s + c.longitude, 0) / mapped.length;
          setLotCenter({ latitude: centerLat, longitude: centerLng });
          setRegion({
            latitude: centerLat,
            longitude: centerLng,
            latitudeDelta: 0.008,
            longitudeDelta: 0.008,
          });
        }
      } catch {
        // Lots fetch failed — boundary stays empty, fallback region used
      }
    })();
    return () => { cancelled = true; };
  }, [setLotBoundary, setRegion]);

  // Apply filters
  const visibleUnits = useMemo(() => {
    if (!filters) return units;
    return units.filter((u) => {
      if (filters.statuses?.length && !filters.statuses.includes(u.status))
        return false;
      if (filters.types?.length && !filters.types.includes(u.unit_type))
        return false;
      if (filters.makes?.length && !filters.makes.includes(u.make))
        return false;
      return true;
    });
  }, [units, filters]);

  const handleRegionChange = useCallback(
    (r: Region) => {
      setRegion(r);
      setZoomLevel(getZoomLevel(r));
    },
    [setRegion],
  );

  const handleMarkerPress = useCallback(
    (unit: Unit) => {
      setSelectedUnit(unit);
    },
    [setSelectedUnit],
  );

  const handleNavigateToUnit = useCallback(
    (unit: Unit) => {
      if (unit.current_lat != null && unit.current_lng != null) {
        mapRef.current?.animateToRegion(
          {
            latitude: unit.current_lat,
            longitude: unit.current_lng,
            latitudeDelta: 0.001,
            longitudeDelta: 0.001,
          },
          500,
        );
      }
    },
    [],
  );

  const handleMyLocation = useCallback(() => {
    // Recenter on lot
    if (region) {
      mapRef.current?.animateToRegion(region, 500);
    }
  }, [region]);

  const toggleMapType = useCallback(() => {
    setMapTypeSatellite(!mapTypeSatellite);
  }, [mapTypeSatellite, setMapTypeSatellite]);

  const initialRegion: Region = region ?? {
    latitude: lotCenter?.latitude ?? 39.8283,
    longitude: lotCenter?.longitude ?? -98.5795,
    latitudeDelta: 0.008,
    longitudeDelta: 0.008,
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        mapType={mapType}
        initialRegion={initialRegion}
        onRegionChangeComplete={handleRegionChange}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
      >
        {/* Lot boundary polygon */}
        {lotBoundary.length >= 3 && (
          <Polygon
            coordinates={lotBoundary}
            fillColor="rgba(37, 99, 235, 0.08)"
            strokeColor={colors.primary}
            strokeWidth={2}
          />
        )}

        {/* Unit markers */}
        {visibleUnits.map((unit) => (
          <UnitMarker
            key={unit.id}
            unit={unit}
            zoomLevel={zoomLevel}
            onPress={handleMarkerPress}
          />
        ))}
      </MapView>

      {/* Filter button (top-left) */}
      <TouchableOpacity
        style={[styles.floatingButton, styles.filterButton]}
        onPress={() => setFiltersVisible(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.floatingButtonIcon}>&#x2630;</Text>
        {filters &&
          (filters.statuses?.length || filters.types?.length || filters.makes?.length) ? (
          <View style={styles.filterBadge}>
            <Text style={styles.filterBadgeText}>
              {(filters.statuses?.length ?? 0) +
                (filters.types?.length ?? 0) +
                (filters.makes?.length ?? 0)}
            </Text>
          </View>
        ) : null}
      </TouchableOpacity>

      {/* Map type toggle (top-right) */}
      <TouchableOpacity
        style={[styles.floatingButton, styles.mapTypeButton]}
        onPress={toggleMapType}
        activeOpacity={0.8}
      >
        <Text style={styles.floatingButtonIcon}>
          {mapType === 'standard' ? '\u{1F6F0}' : '\u{1F5FA}'}
        </Text>
      </TouchableOpacity>

      {/* My location button (bottom-right) */}
      <TouchableOpacity
        style={[styles.floatingButton, styles.myLocationButton]}
        onPress={handleMyLocation}
        activeOpacity={0.8}
      >
        <Text style={styles.floatingButtonIcon}>&#x1F4CD;</Text>
      </TouchableOpacity>

      {/* Map filters modal */}
      <MapFilters
        visible={filtersVisible}
        onClose={() => setFiltersVisible(false)}
      />

      {/* Bottom sheet for selected unit */}
      {selectedUnit && (
        <UnitBottomSheet
          unit={selectedUnit}
          onNavigate={handleNavigateToUnit}
          onDismiss={() => setSelectedUnit(null)}
        />
      )}
    </GestureHandlerRootView>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  floatingButton: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  floatingButtonIcon: {
    fontSize: 18,
  },
  filterButton: {
    top: Platform.OS === 'ios' ? 60 : 16,
    left: 16,
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
  },
  mapTypeButton: {
    top: Platform.OS === 'ios' ? 60 : 16,
    right: 16,
  },
  myLocationButton: {
    bottom: 100,
    right: 16,
  },
});
