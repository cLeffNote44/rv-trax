import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '@/navigation/types';
import type {
  Unit,
  Tracker,
  UnitNote,
  UnitPhoto,
  MovementEvent,
} from '@rv-trax/shared';
import { UnitStatus } from '@rv-trax/shared';
import { api } from '@/services/api';
import { UnitHeader } from './components/UnitHeader';
import { LocationCard } from './components/LocationCard';
import { TrackerInfoCard } from './components/TrackerInfoCard';
import { NotesSection } from './components/NotesSection';
import { PhotoGallery } from './components/PhotoGallery';
import { MovementHistory } from './components/MovementHistory';
import { getStatusColor } from '@/screens/map/components/UnitMarker';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

type DetailRoute = RouteProp<RootStackParamList, 'UnitDetail'>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatStatus(status: string): string {
  return status
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function daysOnLot(createdAt: string): number {
  const diff = Date.now() - new Date(createdAt).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function formatCurrency(value: number | null): string {
  if (value == null) return '--';
  return `$${value.toLocaleString('en-US')}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const ALL_STATUSES = Object.values(UnitStatus);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const UnitDetailScreen: React.FC = () => {
  const route = useRoute<DetailRoute>();
  const { unitId } = route.params;

  const [unit, setUnit] = useState<Unit | null>(null);
  const [tracker, setTracker] = useState<Tracker | null>(null);
  const [notes, setNotes] = useState<UnitNote[]>([]);
  const [photos, setPhotos] = useState<UnitPhoto[]>([]);
  const [movements, setMovements] = useState<MovementEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [unitRes, notesRes, photosRes, movementsRes] = await Promise.all([
        api.get(`api/v1/units/${unitId}`).json<{
          unit: Unit;
          tracker: Tracker | null;
        }>(),
        api.get(`api/v1/units/${unitId}/notes`).json<{ data: UnitNote[] }>(),
        api.get(`api/v1/units/${unitId}/photos`).json<{ data: UnitPhoto[] }>(),
        api
          .get(`api/v1/units/${unitId}/movements?days=14`)
          .json<{ data: MovementEvent[] }>(),
      ]);
      setUnit(unitRes.unit);
      setTracker(unitRes.tracker);
      setNotes(notesRes.data);
      setPhotos(photosRes.data);
      setMovements(movementsRes.data);
    } catch {
      // Error handling: keep stale data
    }
  }, [unitId]);

  useEffect(() => {
    setLoading(true);
    fetchAll().finally(() => setLoading(false));
  }, [fetchAll]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  const handleStatusChange = useCallback(
    async (newStatus: string) => {
      setStatusDropdownOpen(false);
      if (!unit) return;
      try {
        await api.patch(`api/v1/units/${unitId}`, {
          json: { status: newStatus },
        });
        setUnit({ ...unit, status: newStatus as any });
      } catch {
        // Revert on error - already showing current state
      }
    },
    [unit, unitId],
  );

  const handleNavigate = useCallback(() => {
    // In production, this would open system navigation or center the main map
    // For now it is a placeholder
  }, []);

  const handleTakePhoto = useCallback(() => {
    // In production, open camera via react-native-vision-camera
  }, []);

  if (loading || !unit) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* 1. Hero */}
      <UnitHeader unit={unit} />

      {/* 2. Status Section */}
      <View style={styles.statusSection}>
        <Text style={styles.sectionLabel}>Status</Text>
        <TouchableOpacity
          style={styles.statusSelector}
          onPress={() => setStatusDropdownOpen((v) => !v)}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.statusDot,
              { backgroundColor: getStatusColor(unit.status) },
            ]}
          />
          <Text style={styles.statusSelectorText}>
            {formatStatus(unit.status)}
          </Text>
          <Text style={styles.chevron}>{statusDropdownOpen ? '^' : 'v'}</Text>
        </TouchableOpacity>

        {statusDropdownOpen && (
          <View style={styles.statusDropdown}>
            {ALL_STATUSES.map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.statusOption,
                  s === unit.status && styles.statusOptionActive,
                ]}
                onPress={() => handleStatusChange(s)}
              >
                <View
                  style={[
                    styles.statusOptionDot,
                    { backgroundColor: getStatusColor(s) },
                  ]}
                />
                <Text
                  style={[
                    styles.statusOptionText,
                    s === unit.status && styles.statusOptionTextActive,
                  ]}
                >
                  {formatStatus(s)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* 3. Location Card */}
      <LocationCard unit={unit} onNavigate={handleNavigate} />

      {/* 4. Tracker Card */}
      <TrackerInfoCard tracker={tracker} />

      {/* 5. Details */}
      <View style={styles.detailsCard}>
        <Text style={styles.sectionTitle}>Details</Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>VIN</Text>
          <Text style={styles.detailValue} numberOfLines={1}>
            {unit.vin || '--'}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Type</Text>
          <Text style={styles.detailValue}>{formatStatus(unit.unit_type)}</Text>
        </View>
        {unit.length_ft != null && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Length</Text>
            <Text style={styles.detailValue}>{unit.length_ft} ft</Text>
          </View>
        )}
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>MSRP</Text>
          <Text style={styles.detailValue}>{formatCurrency(unit.msrp)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Days on Lot</Text>
          <Text style={styles.detailValue}>{daysOnLot(unit.created_at)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Arrival Date</Text>
          <Text style={styles.detailValue}>{formatDate(unit.created_at)}</Text>
        </View>
        {unit.floorplan && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Floorplan</Text>
            <Text style={styles.detailValue}>{unit.floorplan}</Text>
          </View>
        )}
      </View>

      {/* 6. Notes */}
      <NotesSection
        unitId={unitId}
        notes={notes}
        onNoteAdded={handleRefresh}
      />

      {/* 7. Photos */}
      <PhotoGallery photos={photos} onTakePhoto={handleTakePhoto} />

      {/* 8. Movement History */}
      <MovementHistory events={movements} />

      {/* Bottom spacer */}
      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },

  // Status Section
  statusSection: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray500,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.sm,
  },
  statusSelectorText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.gray800,
  },
  chevron: {
    fontSize: 14,
    color: colors.gray400,
  },
  statusDropdown: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  statusOptionActive: {
    backgroundColor: colors.primaryLight,
  },
  statusOptionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  statusOptionText: {
    fontSize: 14,
    color: colors.gray700,
  },
  statusOptionTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },

  // Details card
  detailsCard: {
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.gray900,
    marginBottom: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  detailLabel: {
    fontSize: 14,
    color: colors.gray500,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray800,
    maxWidth: '60%',
    textAlign: 'right',
  },

  bottomSpacer: {
    height: spacing.xxl,
  },
});
